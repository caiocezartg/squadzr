import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discordInviteCheckResponseSchema, errorResponseSchema } from '@squadzr/schemas'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import { signIn, type TestUser } from '@test/harness/auth'
import { get } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// The Discord invite check through Fastify injection against a real PostgreSQL 16 database. Discord itself
// is replaced by a stub: no test reaches the network.

const PREVIEW = {
  name: 'VALORANT',
  iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
  backdropUrl: null,
  memberCount: 2_946_792,
  onlineCount: 362_025,
  expiresAt: null,
}

let server: TestServer
let discord: { fetch: ReturnType<typeof vi.fn<DiscordInvitePreviewProvider['fetch']>> }
let user: TestUser

const answers = (outcome: DiscordInvitePreviewOutcome) => discord.fetch.mockResolvedValue(outcome)

beforeEach(async () => {
  discord = { fetch: vi.fn<DiscordInvitePreviewProvider['fetch']>() }
  server = await buildTestServer({}, { discordPreviews: discord })
  user = await signIn(server, 'Player')
})

afterEach(async () => {
  await server.close()
})

describe('GET /api/discord/invites/:code', () => {
  it('returns the server behind an invite that never expires', async () => {
    answers({ kind: 'found', preview: PREVIEW })

    const response = await get(server, '/api/discord/invites/valorant', user)

    expect(response.statusCode, response.body).toBe(200)
    expect(discordInviteCheckResponseSchema.parse(response.json())).toEqual({
      status: 'valid',
      server: { name: 'VALORANT', iconUrl: PREVIEW.iconUrl, memberCount: 2_946_792 },
      expires: false,
    })
    expect(discord.fetch).toHaveBeenCalledWith('valorant')
  })

  it('says when the invite expires', async () => {
    answers({ kind: 'found', preview: { ...PREVIEW, expiresAt: '2026-11-01T12:00:00+00:00' } })

    const response = await get(server, '/api/discord/invites/valorant', user)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({ status: 'valid', expires: true })
  })

  it('answers invalid for an invite Discord does not know', async () => {
    answers({ kind: 'invalid' })

    const response = await get(server, '/api/discord/invites/gone', user)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'invalid' })
  })

  it.each<[string, DiscordInvitePreviewOutcome]>([
    ['a rate limited Discord', { kind: 'rate_limited' }],
    ['an unreachable Discord', { kind: 'unreachable' }],
  ])('answers unknown for %s', async (_, outcome) => {
    answers(outcome)

    const response = await get(server, '/api/discord/invites/valorant', user)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ status: 'unknown' })
  })

  it('answers 401 without a session and never asks Discord', async () => {
    const response = await get(server, '/api/discord/invites/valorant')

    expect(response.statusCode).toBe(401)
    expect(discord.fetch).not.toHaveBeenCalled()
  })

  it.each(['ab%20cd', 'a'.repeat(65), 'ab.cd'])(
    'answers 400 to the code %j and never asks Discord',
    async (code) => {
      const response = await get(server, `/api/discord/invites/${code}`, user)

      expect(response.statusCode).toBe(400)
      expect(response.json()).toMatchObject({ error: 'VALIDATION_ERROR' })
      expect(discord.fetch).not.toHaveBeenCalled()
    }
  )
})

describe('GET /api/discord/invites/:code rate limit', () => {
  const REQUESTS_PER_MINUTE = 30

  /** Asks about `count` different codes, as a loop varying the code would, and returns every status. */
  async function ask(as: TestUser | null, count: number, firstCode = 0): Promise<number[]> {
    const statuses: number[] = []
    for (let index = 0; index < count; index++) {
      const response = await get(server, `/api/discord/invites/code${firstCode + index}`, as)
      statuses.push(response.statusCode)
    }
    return statuses
  }

  beforeEach(() => {
    answers({ kind: 'invalid' })
  })

  it('answers the 31st request of a minute from one user with 429 and the error shape', async () => {
    const first = await ask(user, REQUESTS_PER_MINUTE)

    const response = await get(server, '/api/discord/invites/code-over', user)

    expect(first.every((status) => status === 200)).toBe(true)
    expect(response.statusCode, response.body).toBe(429)
    expect(errorResponseSchema.parse(response.json())).toEqual({
      error: 'RATE_LIMITED',
      message: 'Too many requests. Try again shortly.',
    })
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    // The limited request never reached Discord.
    expect(discord.fetch).toHaveBeenCalledTimes(REQUESTS_PER_MINUTE)
  })

  it('counts each user on their own', async () => {
    const other = await signIn(server, 'Other')
    await ask(user, REQUESTS_PER_MINUTE + 1)

    const statuses = await ask(other, REQUESTS_PER_MINUTE)

    expect(statuses.every((status) => status === 200)).toBe(true)
    expect((await get(server, '/api/discord/invites/again', user)).statusCode).toBe(429)
  })

  it('answers 401 to a request without a session however many it sends, and spends no quota', async () => {
    // A limiter that ran before authentication would key these on the address and answer 429 from the 31st.
    const anonymous = await ask(null, REQUESTS_PER_MINUTE + 5)

    const signedIn = await ask(user, REQUESTS_PER_MINUTE)

    expect(anonymous.every((status) => status === 401)).toBe(true)
    expect(signedIn.every((status) => status === 200)).toBe(true)
    expect(discord.fetch).toHaveBeenCalledTimes(REQUESTS_PER_MINUTE)
  })

  it('lets a user ask again once the window has passed', async () => {
    await server.close()
    server = await buildTestServer(
      {},
      { discordPreviews: discord, discordInviteRateLimit: { max: 2, timeWindowMs: 50 } }
    )
    user = await signIn(server, 'Player')

    expect(await ask(user, 3)).toEqual([200, 200, 429])
    await new Promise((resolve) => setTimeout(resolve, 80))

    expect(await ask(user, 1, 10)).toEqual([200])
  })
})
