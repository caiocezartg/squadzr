import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { playerSchema, roomMemberSchema, roomSchema } from '@squadzr/schemas'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import {
  DISCORD_INVITE,
  countMembers,
  createRoom,
  findRoomRow,
  get,
  insertGame,
  joinAll,
  postRoom,
  roomAction,
  setRoomStatus,
} from '@test/harness/rooms'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

// Characterizes the room HTTP API through Fastify injection against a real
// PostgreSQL 16 database. Behavior tagged "replaced in CCC-3x" is the current
// contract only until that ticket lands; do not treat it as permanent.

let server: TestServer
let host: TestUser
let gameId: string

beforeEach(async () => {
  server = await buildTestServer()
  host = await signIn(server, 'Host')
  gameId = (await insertGame(server)).id
})

afterEach(async () => {
  await server.close()
})

const UNAUTHORIZED = { error: 'UNAUTHORIZED', message: 'Authentication required' }

describe('POST /api/rooms', () => {
  it('creates a room owned by the caller and persists the host as the first member', async () => {
    const response = await postRoom(server, host, {
      gameId,
      name: '  Ranked squad  ',
      maxPlayers: 4,
      tags: ['#Ranked', 'EU'],
      language: 'en',
    })

    expect(response.statusCode).toBe(201)
    const { room } = response.json<{ room: Record<string, unknown> }>()
    expect(Object.keys(room).sort()).toEqual(
      [
        'code',
        'createdAt',
        'discordLink',
        'gameId',
        'hostId',
        'id',
        'language',
        'maxPlayers',
        'name',
        'status',
        'tags',
        'updatedAt',
      ].sort()
    )
    expect(room).toMatchObject({
      name: 'Ranked squad',
      hostId: host.id,
      gameId,
      status: 'waiting',
      maxPlayers: 4,
      discordLink: DISCORD_INVITE,
      tags: ['ranked', 'eu'],
      language: 'en',
    })
    expect(room['code']).toMatch(/^[A-Z0-9]{6}$/)
    expect(await countMembers(server, String(room['id']))).toBe(1)
  })

  it('defaults maxPlayers to the game capacity, tags to [] and language to pt-br', async () => {
    const game = await insertGame(server, 3)

    const room = await createRoom(server, host, { gameId: game.id })

    expect(room).toMatchObject({ maxPlayers: 3, tags: [], language: 'pt-br' })
  })

  it('requires authentication', async () => {
    const response = await postRoom(server, null, { gameId })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })

  it('rejects a session cookie with a forged signature', async () => {
    const forged = host.headers.cookie.replace(/\.[^.]+$/, '.forged')

    const response = await server.app.inject({
      method: 'POST',
      url: '/api/rooms',
      headers: { cookie: forged },
      payload: { name: 'Squad', gameId, discordLink: DISCORD_INVITE },
    })

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })

  it('validates the body before authentication is checked', async () => {
    const response = await postRoom(server, null, { gameId: 'not-a-uuid' })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'body/gameId Invalid game ID',
    })
  })

  // The message is `<location>/<field> <first issue>`; custom Zod messages are kept verbatim.
  it.each([
    ['an empty name', { name: '   ' }, 'body/name Room name is required'],
    ['a name longer than 30 characters', { name: 'x'.repeat(31) }, 'body/name Room name too long'],
    [
      'a non-Discord invite link',
      { discordLink: 'https://example.com/invite' },
      'body/discordLink Discord link must be a valid Discord invite URL',
    ],
    ['maxPlayers below 2', { maxPlayers: 1 }, /^body\/maxPlayers /],
    ['maxPlayers above 20', { maxPlayers: 21 }, /^body\/maxPlayers /],
    ['more than 5 tags', { tags: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'body/tags Max 5 tags'],
    ['an unsupported language', { language: 'es' as 'en' }, /^body\/language /],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, override, message) => {
    const response = await postRoom(server, host, { gameId, ...override })

    expect(response.statusCode).toBe(400)
    const body = response.json<{ error: string; message: string }>()
    expect(body).toEqual({ error: 'VALIDATION_ERROR', message: expect.any(String) })
    if (typeof message === 'string') expect(body.message).toBe(message)
    else expect(body.message).toMatch(message)
  })

  it('rejects an unknown game with 400 INVALID_GAME and persists nothing', async () => {
    const unknownGameId = '00000000-0000-4000-8000-000000000000'

    const response = await postRoom(server, host, { gameId: unknownGameId })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'INVALID_GAME',
      message: `Game with id "${unknownGameId}" does not exist`,
    })
    const hosted = await get(server, '/api/rooms/my', host)
    expect(hosted.json()).toEqual({ hosted: [], joined: [] })
  })
})

describe('GET /api/rooms', () => {
  it('lists waiting rooms with memberCount and no isMember for anonymous callers', async () => {
    const room = await createRoom(server, host, { gameId })

    const response = await get(server, '/api/rooms')

    expect(response.statusCode).toBe(200)
    const { rooms } = response.json<{ rooms: Record<string, unknown>[] }>()
    expect(rooms).toHaveLength(1)
    expect(rooms[0]).toMatchObject({ id: room.id, code: room.code, memberCount: 1 })
    expect(rooms[0]).not.toHaveProperty('isMember')
  })

  it('flags isMember for the authenticated caller', async () => {
    const [member, outsider] = await signInMany(server, 2)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])

    const asMember = await get(server, '/api/rooms', member)
    const asOutsider = await get(server, '/api/rooms', outsider)

    expect(asMember.json()).toMatchObject({ rooms: [{ id: room.id, isMember: true }] })
    expect(asOutsider.json()).toMatchObject({ rooms: [{ id: room.id, isMember: false }] })
  })

  it('excludes rooms that are not waiting', async () => {
    const room = await createRoom(server, host, { gameId })
    await setRoomStatus(server, room.id, 'playing')

    const response = await get(server, '/api/rooms')

    expect(response.json()).toEqual({ rooms: [] })
  })
})

describe('GET /api/rooms/:code', () => {
  it('returns the room and its roster, matching the code case-insensitively', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])

    const response = await get(server, `/api/rooms/${room.code.toLowerCase()}`, host)

    expect(response.statusCode).toBe(200)
    const body = response.json<{ room: unknown; players: unknown[] }>()
    expect(roomSchema.parse(body.room)).toMatchObject({ id: room.id, code: room.code })
    expect(body.players.map((player) => playerSchema.parse(player))).toEqual(
      expect.arrayContaining([
        { id: host.id, name: host.name, image: host.image, isHost: true },
        { id: member!.id, name: member!.name, image: member!.image, isHost: false },
      ])
    )
    expect(body.players).toHaveLength(2)
  })

  // CCC-34 closed the invite leak: non-members get the public projection.
  // Replaced in CCC-36: a Ready Room answers 404 to non-members.
  it('[replaced in CCC-36] answers anonymous callers with the public projection, without invite or roster', async () => {
    const room = await createRoom(server, host, { gameId })

    const response = await get(server, `/api/rooms/${room.code}`)

    expect(response.statusCode).toBe(200)
    const body = response.json<{ room: Record<string, unknown> }>()
    expect(body.room).toMatchObject({ id: room.id, code: room.code })
    expect(body.room).not.toHaveProperty('discordLink')
    expect(body).not.toHaveProperty('players')
    expect(response.body).not.toContain(DISCORD_INVITE)
  })

  it('answers 404 ROOM_NOT_FOUND for an unknown code', async () => {
    const response = await get(server, '/api/rooms/zzzzzz')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: 'ROOM_NOT_FOUND',
      message: 'Room "ZZZZZZ" not found',
    })
  })

  it('answers 400 VALIDATION_ERROR for a code that is not 6 characters', async () => {
    const response = await get(server, '/api/rooms/ABC')

    expect(response.statusCode).toBe(400)
    expect(response.json()).toEqual({
      error: 'VALIDATION_ERROR',
      message: 'params/code Too small: expected string to have >=6 characters',
    })
  })
})

describe('POST /api/rooms/:code/join', () => {
  it('adds a durable membership and returns it', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })

    const response = await roomAction(server, member!, room.code, 'join')

    expect(response.statusCode).toBe(200)
    const body = response.json<{ message: string; roomMember: unknown }>()
    expect(body.message).toBe('Joined room successfully')
    expect(roomMemberSchema.parse(body.roomMember)).toMatchObject({
      roomId: room.id,
      userId: member!.id,
    })
    expect(await countMembers(server, room.id)).toBe(2)
  })

  it('is idempotent for an existing member', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })

    const first = await roomAction(server, member!, room.code, 'join')
    const second = await roomAction(server, member!, room.code, 'join')

    expect(second.statusCode).toBe(200)
    expect(second.json()).toEqual(first.json())
    expect(await countMembers(server, room.id)).toBe(2)
  })

  it('requires authentication', async () => {
    const room = await createRoom(server, host, { gameId })

    const response = await roomAction(server, null, room.code, 'join')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })

  it('answers 404 ROOM_NOT_FOUND for an unknown code', async () => {
    const response = await roomAction(server, host, 'ZZZZZZ', 'join')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toEqual({
      error: 'ROOM_NOT_FOUND',
      message: 'Room "ZZZZZZ" not found',
    })
  })

  it('answers 422 ROOM_NOT_WAITING when the room is not waiting', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await setRoomStatus(server, room.id, 'playing')

    const response = await roomAction(server, member!, room.code, 'join')

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'ROOM_NOT_WAITING',
      message: `Room "${room.id}" is not accepting players (status: playing)`,
    })
  })

  it('fills the room, marks it completed and rejects the next player with 422 ROOM_FULL', async () => {
    const [member, late] = await signInMany(server, 2)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })

    await joinAll(server, room.code, [member!])
    const response = await roomAction(server, late!, room.code, 'join')

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'ROOM_FULL',
      message: `Room "${room.id}" is full`,
    })
    const row = await findRoomRow(server, room.id)
    expect(row?.status).toBe('waiting')
    expect(row?.completedAt).toBeInstanceOf(Date)
    expect(row?.readyNotifiedAt).toBeInstanceOf(Date)
    expect(await countMembers(server, room.id)).toBe(2)
  })
})

describe('POST /api/rooms/:code/leave', () => {
  it('removes a non-host membership and keeps the room', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])

    const response = await roomAction(server, member!, room.code, 'leave')

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ message: 'Left room successfully', success: true })
    expect(await countMembers(server, room.id)).toBe(1)
    expect((await get(server, `/api/rooms/${room.code}`)).statusCode).toBe(200)
  })

  it('deletes the room and every membership when the host leaves', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])

    const response = await roomAction(server, host, room.code, 'leave')

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ message: 'Left room successfully', success: true })
    expect(await findRoomRow(server, room.id)).toBeNull()
    expect(await countMembers(server, room.id)).toBe(0)
    expect((await get(server, `/api/rooms/${room.code}`)).statusCode).toBe(404)
  })

  it('answers 422 NOT_ROOM_MEMBER for a caller without membership', async () => {
    const [outsider] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })

    const response = await roomAction(server, outsider!, room.code, 'leave')

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'NOT_ROOM_MEMBER',
      message: `User "${outsider!.id}" is not a member of room "${room.id}"`,
    })
    expect(await countMembers(server, room.id)).toBe(1)
  })

  it('answers 422 ROOM_COMPLETED once the room is full', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])

    const response = await roomAction(server, member!, room.code, 'leave')

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'ROOM_COMPLETED',
      message: `Room "${room.id}" is completed — players cannot leave`,
    })
    expect(await countMembers(server, room.id)).toBe(2)
  })

  it('requires authentication', async () => {
    const room = await createRoom(server, host, { gameId })

    const response = await roomAction(server, null, room.code, 'leave')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })

  it('answers 404 ROOM_NOT_FOUND for an unknown code', async () => {
    const response = await roomAction(server, host, 'ZZZZZZ', 'leave')

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'ROOM_NOT_FOUND' })
  })
})

describe('GET /api/rooms/my', () => {
  it('groups active rooms into hosted and joined, newest first, with memberCount', async () => {
    const [member] = await signInMany(server, 1)
    const older = await createRoom(server, host, { gameId, name: 'Older' })
    const newer = await createRoom(server, host, { gameId, name: 'Newer' })
    const foreign = await createRoom(server, member!, { gameId, name: 'Foreign' })
    await joinAll(server, older.code, [member!])
    await joinAll(server, foreign.code, [host])

    const response = await get(server, '/api/rooms/my', host)

    expect(response.statusCode).toBe(200)
    const body = response.json<{ hosted: unknown[]; joined: unknown[] }>()
    expect(body.hosted).toMatchObject([
      { id: newer.id, memberCount: 1, isMember: true },
      { id: older.id, memberCount: 2, isMember: true },
    ])
    expect(body.joined).toMatchObject([{ id: foreign.id, memberCount: 2, isMember: true }])
  })

  it('requires authentication', async () => {
    const response = await get(server, '/api/rooms/my')

    expect(response.statusCode).toBe(401)
    expect(response.json()).toEqual(UNAUTHORIZED)
  })
})
