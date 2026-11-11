import { createHmac, randomUUID } from 'node:crypto'
import type { UserRole } from '@squadzr/schemas'
import { account, session, user } from '@infrastructure/database/schema'
import { TEST_AUTH_SECRET, type TestServer } from './test-server'

const SESSION_COOKIE = 'better-auth.session_token'
const SESSION_TTL_MS = 60 * 60 * 1000

export interface TestUser {
  id: string
  name: string
  email: string
  image: string | null
  role: UserRole
  /** The Discord account id of the user's Discord account, when the sign-in created one. */
  discordId: string | null
  /** Request headers carrying a valid Better Auth session cookie for this user. */
  headers: { cookie: string }
}

/** Same format Better Auth (better-call) uses for signed cookies: `token.base64(HMAC-SHA256)`. */
function signSessionToken(token: string): string {
  const signature = createHmac('sha256', TEST_AUTH_SECRET).update(token).digest('base64')
  return encodeURIComponent(`${token}.${signature}`)
}

export interface SignInOptions {
  /** The user's role; a plain `user` unless a test needs an admin. */
  role?: UserRole
  /** Also stores a Discord account row with this account id, as a Discord sign-in does. */
  discordId?: string
}

/**
 * Persists a user and a live session in the test database, so requests go
 * through Better Auth's real `getSession` lookup instead of a stubbed session.
 */
export async function signIn(
  server: TestServer,
  name = 'Player',
  options: SignInOptions = {}
): Promise<TestUser> {
  const id = randomUUID()
  const token = randomUUID().replaceAll('-', '')
  const profile = {
    id,
    name,
    email: `${id}@squadzr.test`,
    image: `https://cdn.squadzr.test/${id}.png`,
  }

  const role = options.role ?? 'user'
  const discordId = options.discordId ?? null

  await server.app.db.insert(user).values({ ...profile, emailVerified: true, role })
  if (discordId) {
    await server.app.db
      .insert(account)
      .values({ id: randomUUID(), accountId: discordId, providerId: 'discord', userId: id })
  }
  await server.app.db.insert(session).values({
    id: randomUUID(),
    token,
    userId: id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })

  return {
    ...profile,
    role,
    discordId,
    headers: { cookie: `${SESSION_COOKIE}=${signSessionToken(token)}` },
  }
}

export async function signInMany(server: TestServer, count: number): Promise<TestUser[]> {
  return Promise.all(Array.from({ length: count }, (_, i) => signIn(server, `Player ${i + 1}`)))
}
