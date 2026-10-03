import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  myRoomsResponseSchema,
  roomLobbyResponseSchema,
  roomsResponseSchema,
  userResponseSchema,
} from '@squadzr/schemas'
import { roomCreatedMessageSchema, wsServerMessageSchema } from '@squadzr/schemas/ws'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import { DISCORD_INVITE, createRoom, get, insertGame, joinAll } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// CCC-34: public catalog/guest payloads never carry the Discord invite or the
// roster; both are lobby details delivered only to authenticated members of the
// room. CCC-36 added the Ready Room access rules (404 for non-members, 60min
// retention) and the user-targeted notification push.

const PRIVATE_ROOM_KEYS = ['discordLink', 'readyAt', 'lastActivityAt']

let server: TestServer
let host: TestUser
let gameId: string
const sessions: RealtimeSession[] = []

async function open(...args: Parameters<typeof connect>): Promise<RealtimeSession> {
  const session = await connect(...args)
  sessions.push(session)
  return session
}

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server.close()
})

describe('GET /api/rooms', () => {
  it.each([
    ['an anonymous caller', () => null],
    ['the host of the room', () => host],
  ])('lists the public projection, without the invite, to %s', async (_caller, caller) => {
    const room = await createRoom(server, host, { gameId })

    const response = await get(server, '/api/rooms', caller())

    expect(response.statusCode).toBe(200)
    const { rooms } = response.json<{ rooms: Record<string, unknown>[] }>()
    expect(roomsResponseSchema.parse({ rooms }).rooms).toMatchObject([{ id: room.id }])
    for (const key of PRIVATE_ROOM_KEYS) expect(rooms[0]).not.toHaveProperty(key)
    expect(response.body).not.toContain(DISCORD_INVITE)
  })
})

describe('GET /api/rooms/:code', () => {
  it('returns the invite and the roster to an authenticated member', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])

    const response = await get(server, `/api/rooms/${room.code}`, member)

    expect(response.statusCode).toBe(200)
    const body = roomLobbyResponseSchema.parse(response.json())
    expect(body.room).toMatchObject({ id: room.id, discordLink: DISCORD_INVITE })
    expect(body.players.map((player) => player.id).sort()).toEqual([host.id, member!.id].sort())
  })

  it('answers an authenticated non-member with the public projection only', async () => {
    const [outsider] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })

    const response = await get(server, `/api/rooms/${room.code}`, outsider)

    expect(response.statusCode).toBe(200)
    const body = response.json<{ room: Record<string, unknown> }>()
    expect(body.room).toMatchObject({ id: room.id, code: room.code, name: room.name })
    for (const key of PRIVATE_ROOM_KEYS) expect(body.room).not.toHaveProperty(key)
    expect(body).not.toHaveProperty('players')
    expect(response.body).not.toContain(DISCORD_INVITE)
    expect(response.body).not.toContain(host.name)
  })

  it('hides a Ready Room from non-members with 404 while its members keep the lobby', async () => {
    const [member, outsider] = await signInMany(server, 2)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])

    const asOutsider = await get(server, `/api/rooms/${room.code}`, outsider!)
    const anonymous = await get(server, `/api/rooms/${room.code}`)
    const asMember = await get(server, `/api/rooms/${room.code}`, member!)

    expect(asOutsider.statusCode).toBe(404)
    expect(asOutsider.json()).toMatchObject({ error: 'ROOM_NOT_FOUND' })
    expect(anonymous.statusCode).toBe(404)
    expect(asMember.statusCode).toBe(200)
    expect(roomLobbyResponseSchema.parse(asMember.json()).room).toMatchObject({
      id: room.id,
      discordLink: DISCORD_INVITE,
    })
  })

  it('stops returning the invite and the roster once the member leaves', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])
    await server.app.inject({
      method: 'POST',
      url: `/api/rooms/${room.code}/leave`,
      headers: member!.headers,
    })

    const response = await get(server, `/api/rooms/${room.code}`, member)

    expect(response.json()).not.toHaveProperty('players')
    expect(response.body).not.toContain(DISCORD_INVITE)
  })
})

describe('GET /api/rooms/my', () => {
  it('keeps the invite on the rooms the caller is a member of', async () => {
    const room = await createRoom(server, host, { gameId })

    const response = await get(server, '/api/rooms/my', host)

    const body = myRoomsResponseSchema.parse(response.json())
    expect(body.hosted).toMatchObject([{ id: room.id, discordLink: DISCORD_INVITE }])
  })
})

describe('JSON dates', () => {
  it('serializes every date as an ISO 8601 UTC string', async () => {
    const room = await createRoom(server, host, { gameId })
    const row = (await get(server, `/api/rooms/${room.code}`, host)).json<{
      room: { createdAt: string; updatedAt: string }
    }>().room

    expect(row.createdAt).toBe(new Date(row.createdAt).toISOString())
    expect(row.updatedAt).toBe(new Date(row.updatedAt).toISOString())
  })

  it('returns the authenticated user profile with ISO dates and the avatar as `image`', async () => {
    const response = await get(server, '/api/users/me', host)

    expect(response.statusCode).toBe(200)
    expect(userResponseSchema.parse(response.json()).user).toMatchObject({
      id: host.id,
      name: host.name,
      email: host.email,
      image: host.image,
    })
  })
})

describe('realtime', () => {
  it('pushes room_created to guest catalog subscribers as the public projection', async () => {
    const guest = await open(server)
    await subscribeCatalog(guest)
    let raw = ''
    guest.client.once('message', (data: Buffer) => (raw = data.toString()))

    const room = await createRoom(server, host, { gameId })

    const [message] = await guest.drain()
    const { payload } = roomCreatedMessageSchema.parse(message)
    expect(payload.room).toMatchObject({ id: room.id, code: room.code, name: room.name })
    for (const key of PRIVATE_ROOM_KEYS) {
      expect((message?.payload as { room: object }).room).not.toHaveProperty(key)
    }
    expect(raw).toContain(room.id)
    expect(raw).not.toContain(DISCORD_INVITE)
  })

  it('sends only messages that satisfy the shared server message contract', async () => {
    const [member] = await signInMany(server, 1)
    const guest = await open(server)
    await subscribeCatalog(guest)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    const hostSocket = await open(server, host)
    const joined = await joinRoomChannel(hostSocket, room.code)
    await joinAll(server, room.code, [member!])
    const memberSocket = await open(server, member!)
    await joinRoomChannel(memberSocket, room.code)
    guest.send({ type: 'join_room', payload: { roomCode: room.code } })

    const received = [
      joined,
      ...(await guest.drain()),
      await hostSocket.next(),
      await hostSocket.next(),
      await hostSocket.next(),
    ]

    expect(received.map((message) => message.type)).toEqual([
      'room_joined',
      'room_created',
      'room_updated',
      'error',
      'notification',
      'player_joined',
      'room_ready',
    ])
    for (const message of received) {
      expect(wsServerMessageSchema.safeParse(message).success, message.type).toBe(true)
    }
  })
})
