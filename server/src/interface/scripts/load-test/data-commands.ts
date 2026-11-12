import { z } from 'zod'
import {
  FOREIGN_LINKS_EXIT_CODE,
  isClean,
  verifyCountsSchema,
  type Tag,
  type VerifyCounts,
} from './cleanup-plan'

const playersSchema = z.array(z.object({ id: z.string(), cookie: z.string().min(1) }))

export type Player = z.infer<typeof playersSchema>[number]

const ATTEMPTS = 3
const RETRY_DELAY_MS = 5_000

export interface CommandResult {
  readonly code: number
  readonly stdout: string
}

/** Runs a shell command and returns its output; stderr passes through to the terminal. */
export async function runShell(command: string): Promise<CommandResult> {
  const shell = process.platform === 'win32' ? ['bash', '-c'] : ['sh', '-c']
  const child = Bun.spawn([...shell, command], {
    stdout: 'pipe',
    stderr: 'inherit',
    stdin: 'ignore',
  })
  const [stdout, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
  return { code, stdout }
}

/** The payload of the output line that starts with `marker`, or null when there is none. */
export function markerPayload(stdout: string, marker: string): string | null {
  const line = stdout.split(/\r?\n/).find((candidate) => candidate.startsWith(`${marker} `))
  return line ? line.slice(marker.length + 1).trim() : null
}

export function parsePlayers(stdout: string): Player[] {
  const payload = markerPayload(stdout, 'LT_PLAYERS')
  if (payload === null) throw new Error('The provision command printed no LT_PLAYERS line')
  return playersSchema.parse(JSON.parse(payload))
}

export function parseVerify(stdout: string): { counts: VerifyCounts; auditEntries: number } {
  const payload = markerPayload(stdout, 'LT_VERIFY')
  if (payload === null) throw new Error('The verify command printed no LT_VERIFY line')
  const audit = markerPayload(stdout, 'LT_AUDIT_ENTRIES')
  return {
    counts: verifyCountsSchema.parse(JSON.parse(payload)),
    auditEntries: audit === null ? -1 : Number(audit),
  }
}

/** A failed command is tried again, except one that stopped on purpose (links of people outside the run). */
function shouldRetry(result: CommandResult): boolean {
  return result.code !== 0 && result.code !== FOREIGN_LINKS_EXIT_CODE
}

/** The database side of a run: provisioning the players, deleting them and proving they are gone. */
export class DataSide {
  constructor(
    private readonly command: string,
    private readonly tag: Tag
  ) {}

  /** Runs a data command, trying again when the connection to the service fails (ssh exits with 255). */
  private async run(subcommand: string): Promise<CommandResult> {
    let result = await runShell(`${this.command} ${subcommand}`)
    for (let attempt = 1; attempt < ATTEMPTS && shouldRetry(result); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      result = await runShell(`${this.command} ${subcommand}`)
    }
    return result
  }

  async provision(count: number): Promise<Player[]> {
    const result = await this.run(`provision --tag ${this.tag} --count ${count}`)
    if (result.code !== 0) throw new Error(`provision exited with code ${result.code}`)
    return parsePlayers(result.stdout)
  }

  async cleanup(): Promise<void> {
    const result = await this.run(`cleanup --tag ${this.tag}`)
    if (result.code === FOREIGN_LINKS_EXIT_CODE) {
      const counts = markerPayload(result.stdout, 'LT_FOREIGN') ?? 'unknown'
      throw new Error(
        `cleanup stopped, nothing deleted: people outside the run are linked to its Squads (${counts}); ` +
          `rerun "cleanup --tag ${this.tag} --allow-foreign-members" to delete anyway`
      )
    }
    if (result.code !== 0) throw new Error(`cleanup exited with code ${result.code}`)
  }

  async verify(): Promise<{ counts: VerifyCounts; auditEntries: number; clean: boolean }> {
    const result = await this.run(`verify --tag ${this.tag}`)
    if (result.code !== 0) throw new Error(`verify exited with code ${result.code}`)
    const parsed = parseVerify(result.stdout)
    return { ...parsed, clean: isClean(parsed.counts) }
  }
}
