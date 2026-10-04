/**
 * CCC-33 characterizations updated for CCC-37's protocol v2: authoritative room
 * snapshots, Membership events after commit and member-based Presence. Identity,
 * catalog privacy and retention checks remain covered through in-memory sockets.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { signIn, signInMany } from '@test/harness/auth'
import {
  createRoom,
  insertGame,
  joinAll,
  markRoomActivity,
  markRoomReady,
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
import { DISCORD_INVITE } from '@test/harness/rooms'

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
    expect(guest.protocol).toEqual({
      type: 'protocol',
      timestamp: expect.any(Number),
      payload: { version: 2 },
    })

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
      room: expect.objectContaining({
        id: room.id,
        code: room.code,
        discordLink: DISCORD_INVITE,
        memberCount: 1,
      }),
      players: [{ id: host.id, name: 'Host', image: host.image, isHost: true }],
      readyAt: null,
      expiresAt: expect.any(String),
      presence: [{ playerId: host.id, online: true }],
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
      message: `User "${outsider!.id}" is not a member of room "${room.id}"`,
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

  it('answers ROOM_NOT_FOUND to non-members of a Ready Room, like a missing room', async () => {
    await setup()
    const [host, member, outsider] = await signInMany(server, 3)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const outsiderSocket = await open(server, outsider!)
    const memberSocket = await open(server, member!)

    // A non-member cannot tell a Ready Room from a missing one: no existence leak.
    outsiderSocket.send({ type: 'join_room', payload: { roomCode: room.code } })
    expect((await outsiderSocket.next()).payload).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: `Room "${room.code}" not found`,
    })

    // A member still subscribes to the room during retention.
    const snapshot = await joinRoomChannel(memberSocket, room.code)
    expect(snapshot.payload).toMatchObject({
      readyAt: expect.any(String),
      players: expect.arrayContaining([expect.objectContaining({ id: member!.id })]),
    })
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)
    expect(await memberSocket.drain()).toEqual([])

    // Past retention the Ready Room is gone for everyone, member included.
    await markRoomReady(server, room.id, 61)
    memberSocket.send({ type: 'join_room', payload: { roomCode: room.code } })
    expect((await memberSocket.next()).payload).toEqual({
      code: 'ROOM_NOT_FOUND',
      message: `Room "${room.code}" not found`,
    })
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

    await joinRoomChannel(socket, room.code.toLowerCase())
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)

    socket.send({ type: 'leave_room', payload: { roomCode: room.code.toLowerCase() } })
    expect(await socket.drain()).toEqual([])
    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })

  it('announces Presence once across multiple sessions of the same member', async () => {
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

    const announced = await hostSocket.drain()
    expect(announced).toEqual([
      {
        type: 'presence_updated',
        timestamp: expect.any(Number),
        payload: { roomCode: room.code, playerId: member!.id, online: true },
      },
    ])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(3)
  })

  it('publishes the complete committed Membership roster after HTTP joins', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server)
    const room = await createRoom(server, host!, { gameId: game.id })
    const hostSocket = await open(server, host!)
    await joinRoomChannel(hostSocket, room.code)

    await joinAll(server, room.code, [member!])

    expect(await hostSocket.drain()).toEqual([
      expect.objectContaining({
        type: 'room_snapshot',
        payload: expect.objectContaining({
          players: expect.arrayContaining([
            expect.objectContaining({ id: host!.id }),
            expect.objectContaining({ id: member!.id }),
          ]),
          presence: [
            { playerId: host!.id, online: true },
            { playerId: member!.id, online: false },
          ],
        }),
      }),
    ])
  })

  it('includes readiness in every snapshot without repeating a readiness event on subscribe', async () => {
    await setup()
    const [host, member] = await signInMany(server, 2)
    const game = await insertGame(server, 2)
    const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 2 })
    await joinAll(server, room.code, [member!])
    const hostSocket = await open(server, host!)
    const memberSocket = await open(server, member!)

    const hostSnapshot = await joinRoomChannel(hostSocket, room.code)
    expect(hostSnapshot.payload).toMatchObject({ readyAt: expect.any(String) })

    const memberSnapshot = await joinRoomChannel(memberSocket, room.code)
    expect(memberSnapshot.payload).toMatchObject({ readyAt: expect.any(String) })
    expect((await hostSocket.next()).type).toBe('presence_updated')
    expect(await memberSocket.drain()).toEqual([])
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
    expect(await catalog.drain()).toEqual([{ ...deleted, type: 'room_removed' }])
  })
})
