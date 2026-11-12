import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import pg from 'pg'
import { z } from 'zod'
import {
  cleanupPlan,
  FOREIGN_LINKS_EXIT_CODE,
  foreignLinkTotal,
  foreignLinksPlan,
  playerEmail,
  tagSchema,
  verifyPlan,
  type PlanStatement,
  type Tag,
} from './cleanup-plan'
import { parseFlags } from './options'

/**
 * The load test's database side: `provision` makes throwaway players with live sessions, `cleanup` deletes a
 * run and `verify` counts what is left. It needs the API's own environment (`DATABASE_URL`,
 * `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`), so it runs inside the `api` service (`railway-data.sh` does that);
 * a session cookie is signed with the auth secret exactly as Better Auth signs one, and neither the secret nor
 * the database address ever leaves the service. Output is one marker line per command.
 */

const SESSION_COOKIE = 'better-auth.session_token'
const SECURE_PREFIX = '__Secure-'
const SESSION_LIFETIME_MS = 3 * 60 * 60_000
const USER_AGENT = 'squadzr-load-test'

const environmentSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
})

const commandSchema = z.discriminatedUnion('command', [
  z.object({
    command: z.literal('provision'),
    tag: tagSchema,
    count: z.coerce.number().int().min(1).max(5000),
  }),
  z.object({
    command: z.literal('cleanup'),
    tag: tagSchema.optional(),
    /** Delete even though people outside the run are linked to its Squads (they lose those links). */
    allowForeignMembers: z
      .enum(['true'])
      .optional()
      .transform((value) => value === 'true'),
  }),
  z.object({ command: z.literal('verify'), tag: tagSchema.optional() }),
])

export interface ProvisionedPlayer {
  readonly id: string
  readonly cookie: string
}

/** Better Auth's signed cookie value: the token, a dot, and its HMAC-SHA256 in base64, URL-encoded. */
export function signedSessionCookie(token: string, secret: string, secure: boolean): string {
  const signature = createHmac('sha256', secret).update(token).digest('base64')
  const name = `${secure ? SECURE_PREFIX : ''}${SESSION_COOKIE}`
  return `${name}=${encodeURIComponent(`${token}.${signature}`)}`
}

const SWITCHES = ['allow-foreign-members']

export function parseArguments(argv: readonly string[]) {
  const [command, ...rest] = argv
  return commandSchema.parse({ command, ...parseFlags(rest, SWITCHES) })
}

export async function provision(
  client: pg.ClientBase,
  env: z.infer<typeof environmentSchema>,
  tag: Tag,
  count: number
): Promise<ProvisionedPlayer[]> {
  const secure = env.BETTER_AUTH_URL.startsWith('https://')
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS)
  const players = Array.from({ length: count }, (_, index) => {
    const token = randomBytes(24).toString('hex')
    return {
      id: randomUUID(),
      name: `LT ${tag} ${index}`,
      email: playerEmail(tag, index),
      sessionId: randomUUID(),
      token,
      cookie: signedSessionCookie(token, env.BETTER_AUTH_SECRET, secure),
    }
  })

  await client.query('BEGIN')
  try {
    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified, role)
       SELECT id, name, email, true, 'user' FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, name, email)`,
      [players.map((p) => p.id), players.map((p) => p.name), players.map((p) => p.email)]
    )
    await client.query(
      `INSERT INTO session (id, token, user_id, expires_at, user_agent)
       SELECT id, token, user_id, $4::timestamp, $5 FROM unnest($1::text[], $2::text[], $3::text[]) AS t(id, token, user_id)`,
      [
        players.map((p) => p.sessionId),
        players.map((p) => p.token),
        players.map((p) => p.id),
        expiresAt.toISOString(),
        USER_AGENT,
      ]
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
  return players.map(({ id, cookie }) => ({ id, cookie }))
}

async function runPlan(
  client: pg.ClientBase,
  plan: readonly PlanStatement[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const statement of plan) {
    const result = await client.query<{ count?: number }>(statement.text, [...statement.values])
    counts[statement.name] = result.rows[0]?.count ?? result.rowCount ?? 0
  }
  return counts
}

/** Thrown when people outside the run are linked to its Squads and the operator did not allow deleting them. */
export class ForeignLinksError extends Error {
  constructor(readonly counts: Readonly<Record<string, number>>) {
    super(`The cleanup would remove ${foreignLinkTotal(counts)} links of people outside the run`)
  }
}

export function foreignLinks(client: pg.ClientBase, tag?: Tag): Promise<Record<string, number>> {
  return runPlan(client, foreignLinksPlan(tag))
}

/**
 * Deletes the run. Before deleting anything it counts the Memberships and Squad Record entries of people
 * outside the run that hang from the run's Squads; with any, it deletes nothing and throws, unless
 * `allowForeignMembers` says the operator accepts losing them.
 */
export async function cleanup(
  client: pg.ClientBase,
  tag?: Tag,
  { allowForeignMembers = false }: { allowForeignMembers?: boolean } = {}
): Promise<Record<string, number>> {
  const foreign = await foreignLinks(client, tag)
  if (!allowForeignMembers && foreignLinkTotal(foreign) > 0) throw new ForeignLinksError(foreign)

  await client.query('BEGIN')
  try {
    const deleted = await runPlan(client, cleanupPlan(tag))
    await client.query('COMMIT')
    return deleted
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

export function verify(client: pg.ClientBase, tag?: Tag): Promise<Record<string, number>> {
  return runPlan(client, verifyPlan(tag))
}

async function auditEntryCount(client: pg.ClientBase): Promise<number> {
  const result = await client.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM audit_entries'
  )
  return result.rows[0]?.count ?? 0
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  const env = environmentSchema.parse(process.env)
  const client = new pg.Client({ connectionString: env.DATABASE_URL, options: '-c timezone=UTC' })
  await client.connect()
  try {
    switch (args.command) {
      case 'provision':
        console.log(
          `LT_PLAYERS ${JSON.stringify(await provision(client, env, args.tag, args.count))}`
        )
        break
      case 'cleanup':
        console.log(
          `LT_CLEANUP ${JSON.stringify(await cleanup(client, args.tag, { allowForeignMembers: args.allowForeignMembers }))}`
        )
        break
      case 'verify':
        console.log(`LT_VERIFY ${JSON.stringify(await verify(client, args.tag))}`)
        console.log(`LT_AUDIT_ENTRIES ${await auditEntryCount(client)}`)
        break
    }
  } finally {
    await client.end()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    if (error instanceof ForeignLinksError) {
      console.log(`LT_FOREIGN ${JSON.stringify(error.counts)}`)
      console.error(
        `${error.message}. Nothing was deleted; rerun with --allow-foreign-members to delete anyway.`
      )
      process.exitCode = FOREIGN_LINKS_EXIT_CODE
      return
    }
    console.error('Load test data command failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
