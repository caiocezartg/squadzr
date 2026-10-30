import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discordInviteCheckResponseSchema } from '@squadzr/schemas'
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
