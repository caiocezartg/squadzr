import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { discordPreviewResponseSchema } from '@squadzr/schemas'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import { createRoom, get, insertGame, joinAll } from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// The Discord preview endpoint through Fastify injection against a real PostgreSQL 16 database. Discord
// itself is replaced by a stub: no test reaches the network.

const SERVER = {
  name: 'VALORANT',
  iconUrl: 'https://cdn.discordapp.com/icons/1/abc.png?size=128',
  backdropUrl: null,
  memberCount: 2_946_792,
  onlineCount: 362_025,
}
// What the provider reads also carries when the invite expires, which the Lobby never shows.
const PREVIEW = { ...SERVER, expiresAt: '2026-11-01T12:00:00.000000+00:00' }

let server: TestServer
let discord: { fetch: ReturnType<typeof vi.fn<DiscordInvitePreviewProvider['fetch']>> }
let host: TestUser
let gameId: string

const answers = (outcome: DiscordInvitePreviewOutcome) => discord.fetch.mockResolvedValue(outcome)

beforeEach(async () => {
  discord = { fetch: vi.fn<DiscordInvitePreviewProvider['fetch']>() }
  server = await buildTestServer({}, { discordPreviews: discord })
  host = await signIn(server, 'Host')
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await server.close()
})

/** A Squad of two with its invite, Ready once the second member joins. */
async function createSquad(options: { ready: boolean }) {
  // Creating the Squad checks its invite too: it exists, whatever a test then has Discord answer.
  discord.fetch.mockResolvedValueOnce({ kind: 'found', preview: PREVIEW })
  const room = await createRoom(server, host, {
    gameId,
    maxPlayers: 2,
    discordLink: 'https://discord.gg/valorant',
  })
  const [guest] = await signInMany(server, 1)
  if (!guest) throw new Error('No guest')
  if (options.ready) await joinAll(server, room.code, [guest])
  discord.fetch.mockClear()
  return { room, guest }
}

describe('GET /api/rooms/:code/discord-preview', () => {
  it('returns the Discord server behind the invite to a member of a Ready Room', async () => {
    answers({ kind: 'found', preview: PREVIEW })
    const { room } = await createSquad({ ready: true })

    const response = await get(server, `/api/rooms/${room.code}/discord-preview`, host)

    expect(response.statusCode, response.body).toBe(200)
    expect(discordPreviewResponseSchema.parse(response.json())).toEqual({ preview: SERVER })
    expect(discord.fetch).toHaveBeenCalledWith('valorant')
  })

  it.each<[string, DiscordInvitePreviewOutcome]>([
    ['an invalid or expired invite', { kind: 'invalid' }],
    ['a rate limited Discord', { kind: 'rate_limited' }],
    ['an unreachable Discord', { kind: 'unreachable' }],
  ])('answers 200 with a null preview for %s', async (_, outcome) => {
    answers(outcome)
    const { room } = await createSquad({ ready: true })

    const response = await get(server, `/api/rooms/${room.code}/discord-preview`, host)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ preview: null })
  })

  it('accepts the code in lower case, as every room route does', async () => {
    answers({ kind: 'found', preview: PREVIEW })
    const { room } = await createSquad({ ready: true })

    const response = await get(
      server,
      `/api/rooms/${room.code.toLowerCase()}/discord-preview`,
      host
    )

    expect(response.statusCode).toBe(200)
  })

  it('answers 401 without a session', async () => {
    const { room } = await createSquad({ ready: true })

    const response = await get(server, `/api/rooms/${room.code}/discord-preview`)

    expect(response.statusCode).toBe(401)
    expect(discord.fetch).not.toHaveBeenCalled()
  })

  it('answers 404 to a user who is not in the Room, and never asks Discord', async () => {
    const { room } = await createSquad({ ready: true })
    const stranger = await signIn(server, 'Stranger')

    const response = await get(server, `/api/rooms/${room.code}/discord-preview`, stranger)

    expect(response.statusCode).toBe(404)
    expect(discord.fetch).not.toHaveBeenCalled()
  })

  it('answers 404 to a user outside an Open Room', async () => {
    const { room } = await createSquad({ ready: false })
    const stranger = await signIn(server, 'Stranger')

    const response = await get(server, `/api/rooms/${room.code}/discord-preview`, stranger)

    expect(response.statusCode).toBe(404)
  })

  it('answers 422 ROOM_NOT_READY to a member of an Open Room', async () => {
    const { room } = await createSquad({ ready: false })

    const response = await get(server, `/api/rooms/${room.code}/discord-preview`, host)

    expect(response.statusCode).toBe(422)
    expect(response.json()).toMatchObject({ error: 'ROOM_NOT_READY' })
    expect(discord.fetch).not.toHaveBeenCalled()
  })

  it('answers 404 for a Room that does not exist', async () => {
    const response = await get(server, '/api/rooms/ZZZZZZ/discord-preview', host)

    expect(response.statusCode).toBe(404)
  })
})
