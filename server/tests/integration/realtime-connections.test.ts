/**
 * Characterization of the current `/ws` protocol: connection identity (session vs guest),
 * the catalog ("lobby") subscription and the room channel. Sockets are in-memory
 * (`app.injectWS`), so nothing here depends on ports, the network or wall-clock waits.
 *
 * Regression-sensitive behavior recorded here is what the client relies on today.
 * Assertions tagged `REPLACED BY CCC-37` document behavior the realtime module rewrite
 * (snapshots, Presence by member/session) is expected to change, not preserve.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { signIn, signInMany } from '@test/harness/auth'
import {
  createRoom,
  insertGame,
  joinAll,
  markRoomActivity,
  postRoom,
  roomAction,
} from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  subscriptionState,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

let server: TestServer
const sessions: RealtimeSession[] = []

async function open(...args: Parameters<typeof connect>): Promise<RealtimeSession> {
  const session = await connect(...args)
  sessions.push(session)
  return session
}

async function setup(): Promise<TestServer> {
  server = await buildTestServer()
  return server
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
})

describe('connection identity', () => {
  it('accepts a guest without a session and answers ping with pong', async () => {
    await setup()
    const guest = await open(server)

    guest.send({ type: 'ping' })

    expect(await guest.next()).toEqual({ type: 'pong', timestamp: expect.any(Number) })
  })

  it('treats a forged session cookie as a guest instead of rejecting the upgrade', async () => {
    await setup()
    const forged = await open(server, null, { cookie: 'better-auth.session_token=forged.token' })

    forged.send({ type: 'join_room', payload: { roomCode: 'ABCDEF' } })

    expect((await forged.next()).payload).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    })
  })

  it('lets a guest subscribe to the catalog but not to a room channel', async () => {
    await setup()
    const guest = await open(server)

    await subscribeCatalog(guest)
    guest.send({ type: 'join_room', payload: { roomCode: 'ABCDEF' } })
    guest.send({ type: 'leave_room', payload: { roomCode: 'ABCDEF' } })

    expect(await guest.drain()).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({ code: 'UNAUTHORIZED' }),
      }),
    ])
    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })

  it('identifies an authenticated member from the session cookie, never from the payload', async () => {
    await setup()
    const host = await signIn(server, 'Host')
    const game = await insertGame(server, 3)
    const room = await createRoom(server, host, { gameId: game.id, maxPlayers: 3 })
    const socket = await open(server, host)

    const joined = await joinRoomChannel(socket, room.code)

    expect(joined.payload).toEqual({
      roomId: room.id,
      roomCode: room.code,
      players: [{ id: host.id, name: 'Host', image: host.image, isHost: true }],
    })
  })

  it('rejects room channels for unknown rooms and for users without Membership', async () => {
    await setup()
    const [host, outsider] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    const socket = await open(server, outsider!)

    socket.send({ type: 'join_room', payload: { roomCode: 'ZZZZZZ' } })
    expect((await socket.next()).payload).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: 'Room "ZZZZZZ" not found',
    })

    socket.send({ type: 'join_room', payload: { roomCode: room.code } })
    expect((await socket.next()).payload).toEqual({
      code: 'NOT_ROOM_MEMBER',
      message: 'You are not a member of this room',
    })
    expect(subscriptionState(server).roomSockets(room.code)).toBe(0)
  })

  it('rejects room channels once the Open Room expired, even before deletion', async () => {
    await setup()
    const host = await signIn(server)
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id })
    await markRoomActivity(server, room.id, 25 * 60)
    const socket = await open(server, host)

    socket.send({ type: 'join_room', payload: { roomCode: room.code } })

    expect((await socket.next()).payload).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: `Room "${room.code}" not found`,
    })
    expect(subscriptionState(server).roomSockets(room.code)).toBe(0)
  })
})

describe('catalog subscription', () => {
  it('pushes room_created / room_updated only while subscribed', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const viewer = await open(server)
    await subscribeCatalog(viewer)

    const room = await createRoom(server, host!, { gameId: game.id })
    await joinAll(server, room.code, [member!])

    expect((await viewer.drain()).map((message) => message.type)).toEqual([
      'room_created',
      'room_updated',
    ])

    viewer.send({ type: 'unsubscribe_lobby' })
    await roomAction(server, member!, room.code, 'leave')

    expect(await viewer.drain()).toEqual([])
    expect(subscriptionState(server).catalogSubscribers()).toBe(0)
  })

  it('does not push catalog events to connections that never subscribed', async () => {
    await setup()
    const host = await signIn(server)
    const game = await insertGame(server)
    const idle = await open(server)

    expect((await postRoom(server, host, { gameId: game.id })).statusCode).toBe(201)

    expect(await idle.drain()).toEqual([])
  })

  it('keeps one catalog entry per socket when subscribe_lobby is repeated', async () => {
    await setup()
    const viewer = await open(server)

    await subscribeCatalog(viewer)
    await subscribeCatalog(viewer)

    expect(subscriptionState(server).catalogSubscribers()).toBe(1)
  })

  it('removes the catalog subscription when the socket closes', async () => {
    await setup()
    const viewer = await open(server)
    const other = await open(server)
    await subscribeCatalog(viewer)
    await subscribeCatalog(other)

    viewer.client.close()
    await viewer.serverClosed

    expect(subscriptionState(server).catalogSubscribers()).toBe(1)
  })
})

describe('room channel subscription', () => {
  it('registers the socket on join and unregisters it on leave_room', async () => {
    await setup()
    const host = await signIn(server)
    const game = await insertGame(server)
    const room = await createRoom(server, host, { gameId: game.id })
    const socket = await open(server, host)

    await joinRoomChannel(socket, room.code)
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)

    socket.send({ type: 'leave_room', payload: { roomCode: room.code } })
    expect(await socket.drain()).toEqual([])
    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })

  it('announces a (re)joining socket to the other sockets of the room as player_joined', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    await joinAll(server, room.code, [member!])
    const hostSocket = await open(server, host!)
    await joinRoomChannel(hostSocket, room.code)

    const firstTab = await open(server, member!)
    await joinRoomChannel(firstTab, room.code)
    const secondTab = await open(server, member!)
    await joinRoomChannel(secondTab, room.code)

    // REPLACED BY CCC-37: every socket (a second tab, a reconnect) re-announces the same
    // Membership as `player_joined`. Presence must count one online member per user.
    const announced = await hostSocket.drain()
    expect(announced.map((message) => message.type)).toEqual(['player_joined', 'player_joined'])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(3)
  })

  it('does not tell room sockets about Membership changes made over HTTP', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    const hostSocket = await open(server, host!)
    await joinRoomChannel(hostSocket, room.code)

    await joinAll(server, room.code, [member!])

    // REPLACED BY CCC-37: the durable join is invisible to the room until the new member
    // opens their own socket (Membership roster is driven by socket Presence today).
    expect(await hostSocket.drain()).toEqual([])
  })

  it('re-emits room_ready to the whole room on every join_room of a full room', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const hostSocket = await open(server, host!)
    const memberSocket = await open(server, member!)

    await joinRoomChannel(hostSocket, room.code)
    expect((await hostSocket.next()).type).toBe('room_ready')

    await joinRoomChannel(memberSocket, room.code)

    // REPLACED BY CCC-37: readiness is re-broadcast as an event per join instead of being
    // part of an authoritative snapshot.
    expect((await hostSocket.next()).type).toBe('player_joined')
    expect((await hostSocket.next()).type).toBe('room_ready')
    expect((await memberSocket.next()).type).toBe('room_ready')
    expect(await hostSocket.drain()).toEqual([])
  })

  it('broadcasts room_deleted to room sockets and catalog subscribers when the host leaves', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    await joinAll(server, room.code, [member!])
    const memberSocket = await open(server, member!)
    await joinRoomChannel(memberSocket, room.code)
    const catalog = await open(server)
    await subscribeCatalog(catalog)

    await roomAction(server, host!, room.code, 'leave')

    const deleted = {
      type: 'room_deleted',
      timestamp: expect.any(Number),
      payload: { roomId: room.id, roomCode: room.code },
    }
    expect(await memberSocket.drain()).toEqual([deleted])
    expect(await catalog.drain()).toEqual([deleted])
  })
})
