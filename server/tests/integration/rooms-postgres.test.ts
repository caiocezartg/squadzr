import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '@/app'
import { ROOM } from '@config/constants'
import { signIn, signInMany, type TestUser } from '@test/harness/auth'
import {
  backdateCompletion,
  countMembers,
  createRoom,
  get,
  insertGame,
  joinAll,
  postRoom,
  roomAction,
} from '@test/harness/rooms'
import { buildTestServer, createTestEnv, type TestServer } from '@test/harness/test-server'

// Characterizes the PostgreSQL-backed rules behind the room API: the capacity
// transaction, catalog/My Rooms queries and the active-room limit counts.
// Behavior tagged "replaced in CCC-36" is current only until that ticket lands.

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

async function listedRoomIds(): Promise<string[]> {
  const response = await get(server, '/api/rooms')
  expect(response.statusCode).toBe(200)
  return response.json<{ rooms: { id: string }[] }>().rooms.map((room) => room.id)
}

async function myRooms(user: TestUser): Promise<{ hosted: string[]; joined: string[] }> {
  const response = await get(server, '/api/rooms/my', user)
  expect(response.statusCode).toBe(200)
  const body = response.json<{ hosted: { id: string }[]; joined: { id: string }[] }>()
  return { hosted: body.hosted.map((r) => r.id), joined: body.joined.map((r) => r.id) }
}

async function notificationCount(user: TestUser): Promise<number> {
  const response = await get(server, '/api/notifications', user)
  return response.json<{ notifications: unknown[] }>().notifications.length
}

/** Creates a room for `owner` and fills every free seat with fresh users. */
async function createFullRoom(owner: TestUser, maxPlayers = 2) {
  const room = await createRoom(server, owner, { gameId, maxPlayers })
  const members = await signInMany(server, maxPlayers - 1)
  await joinAll(server, room.code, members)
  return { room, members }
}

describe('Membership durability', () => {
  it('tracks create, join and leave as rows in room_members', async () => {
    const [first, second] = await signInMany(server, 2)
    const room = await createRoom(server, host, { gameId })
    expect(await countMembers(server, room.id)).toBe(1)

    await joinAll(server, room.code, [first!, second!])
    expect(await countMembers(server, room.id)).toBe(3)

    await roomAction(server, first!, room.code, 'leave')
    expect(await countMembers(server, room.id)).toBe(2)

    const listed = await get(server, '/api/rooms')
    expect(listed.json()).toMatchObject({ rooms: [{ id: room.id, memberCount: 2 }] })
  })

  it('survives a server restart on the same database', async () => {
    const [member] = await signInMany(server, 1)
    const room = await createRoom(server, host, { gameId })
    await joinAll(server, room.code, [member!])

    await server.app.close()
    const restarted = await buildApp({
      env: createTestEnv({ DATABASE_URL: server.databaseUrl }),
      logger: false,
    })
    try {
      const response = await restarted.inject({ method: 'GET', url: `/api/rooms/${room.code}` })
      expect(response.json<{ players: unknown[] }>().players).toHaveLength(2)
    } finally {
      await restarted.close()
    }
  })
})

describe('concurrent joins', () => {
  it('never exceed the capacity of an open room', async () => {
    const maxPlayers = 4
    const room = await createRoom(server, host, { gameId, maxPlayers })
    const contenders = await signInMany(server, 8)

    const responses = await Promise.all(
      contenders.map((user) => roomAction(server, user, room.code, 'join'))
    )

    const statuses = responses.map((response) => response.statusCode)
    expect(statuses.filter((status) => status === 200)).toHaveLength(maxPlayers - 1)
    expect(statuses.filter((status) => status === 422)).toHaveLength(8 - (maxPlayers - 1))
    for (const rejected of responses.filter((response) => response.statusCode === 422)) {
      expect(rejected.json()).toMatchObject({ error: 'ROOM_FULL' })
    }
    expect(await countMembers(server, room.id)).toBe(maxPlayers)
  })

  it('notify every member exactly once when the last seat is taken concurrently', async () => {
    const room = await createRoom(server, host, { gameId, maxPlayers: 3 })
    const contenders = await signInMany(server, 5)

    const responses = await Promise.all(
      contenders.map((user) => roomAction(server, user, room.code, 'join'))
    )

    const joined = contenders.filter((_, i) => responses[i]!.statusCode === 200)
    const rejected = contenders.filter((_, i) => responses[i]!.statusCode !== 200)
    expect(joined).toHaveLength(2)
    for (const user of [host, ...joined]) expect(await notificationCount(user)).toBe(1)
    for (const user of rejected) expect(await notificationCount(user)).toBe(0)
  })
})

describe('catalog of open rooms (GET /api/rooms)', () => {
  // Replaced in CCC-36: a Ready Room must leave the catalog immediately.
  it(`[replaced in CCC-36] keeps a full room listed for GRACE_WINDOW_MS (${ROOM.GRACE_WINDOW_MS} ms)`, async () => {
    const { room } = await createFullRoom(host)

    expect(await listedRoomIds()).toEqual([room.id])
    const [listed] = (await get(server, '/api/rooms')).json<{ rooms: unknown[] }>().rooms
    expect(listed).toMatchObject({ memberCount: 2, maxPlayers: 2 })

    await backdateCompletion(server, room.id, ROOM.GRACE_WINDOW_MS / 60_000 - 1)
    expect(await listedRoomIds()).toEqual([room.id])
  })

  it('drops a full room once GRACE_WINDOW_MS has elapsed since completion', async () => {
    const { room } = await createFullRoom(host)

    await backdateCompletion(server, room.id, ROOM.GRACE_WINDOW_MS / 60_000 + 1)

    expect(await listedRoomIds()).toEqual([])
  })
})

describe('full rooms and My Rooms', () => {
  // Replaced in CCC-36: Ready Rooms will stay visible in My Rooms.
  it('[replaced in CCC-36] hides a full room from the host and members immediately', async () => {
    const { room, members } = await createFullRoom(host)
    const open = await createRoom(server, host, { gameId })

    expect(await myRooms(host)).toEqual({ hosted: [open.id], joined: [] })
    expect(await myRooms(members[0]!)).toEqual({ hosted: [], joined: [] })
    expect(await countMembers(server, room.id)).toBe(2)
  })
})

describe('active-room limits (countActiveByHostId / countActiveByUserId)', () => {
  it(`rejects hosting more than ROOM.CREATE_LIMIT (${ROOM.CREATE_LIMIT}) active rooms`, async () => {
    for (let i = 0; i < ROOM.CREATE_LIMIT; i++) await createRoom(server, host, { gameId })

    const response = await postRoom(server, host, { gameId })

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'ROOM_CREATE_LIMIT_REACHED',
      message: `You can only host ${ROOM.CREATE_LIMIT} active rooms at a time`,
    })
  })

  it('does not count full rooms towards the host limit', async () => {
    await createFullRoom(host)
    for (let i = 1; i < ROOM.CREATE_LIMIT; i++) await createRoom(server, host, { gameId })

    const response = await postRoom(server, host, { gameId })

    expect(response.statusCode).toBe(201)
  })

  it(`rejects joining more than ROOM.JOIN_LIMIT (${ROOM.JOIN_LIMIT}) active rooms`, async () => {
    const [player] = await signInMany(server, 1)
    const hosts = await signInMany(server, ROOM.JOIN_LIMIT + 1)
    const rooms = await Promise.all(hosts.map((owner) => createRoom(server, owner, { gameId })))
    for (const room of rooms.slice(0, ROOM.JOIN_LIMIT)) await joinAll(server, room.code, [player!])

    const response = await roomAction(server, player!, rooms[ROOM.JOIN_LIMIT]!.code, 'join')

    expect(response.statusCode).toBe(422)
    expect(response.json()).toEqual({
      error: 'ROOM_JOIN_LIMIT_REACHED',
      message: `You can only be in ${ROOM.JOIN_LIMIT} active rooms at a time`,
    })
  })

  it('counts hosted rooms as memberships and ignores full rooms for the join limit', async () => {
    const [player] = await signInMany(server, 1)
    await createFullRoom(player!)
    await createRoom(server, player!, { gameId })
    const hosts = await signInMany(server, ROOM.JOIN_LIMIT)
    const rooms = await Promise.all(hosts.map((owner) => createRoom(server, owner, { gameId })))
    // Active: 1 open hosted room + JOIN_LIMIT - 2 joined rooms; the full hosted room is ignored.
    await joinAll(server, rooms[0]!.code, [player!])
    for (const room of rooms.slice(1, ROOM.JOIN_LIMIT - 2))
      await joinAll(server, room.code, [player!])

    const accepted = await roomAction(server, player!, rooms[ROOM.JOIN_LIMIT - 2]!.code, 'join')
    const rejected = await roomAction(server, player!, rooms[ROOM.JOIN_LIMIT - 1]!.code, 'join')

    expect(accepted.statusCode).toBe(200)
    expect(rejected.statusCode).toBe(422)
    expect(rejected.json()).toMatchObject({ error: 'ROOM_JOIN_LIMIT_REACHED' })
  })
})
