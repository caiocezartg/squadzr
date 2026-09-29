/**
 * Characterization of graceful and abnormal disconnects, and of how the current event
 * stream conflates durable Membership (PostgreSQL `room_members`) with transport Presence
 * (open sockets). Every `REPLACED BY CCC-37` assertion records a conflation that the
 * realtime module rewrite must remove; new Presence tests should be written against the
 * roadmap rules (one online member per user, 10 s grace, heartbeat), not against these.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { signInMany, type TestUser } from '@test/harness/auth'
import { countMembers, createRoom, insertGame, joinAll, roomAction } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  subscriptionState,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'

const NORMAL_CLOSURE = 1000
const ABNORMAL_CLOSURE = 1006
const NO_STATUS_RECEIVED = 1005

let server: TestServer
const sessions: RealtimeSession[] = []

async function open(user: TestUser | null): Promise<RealtimeSession> {
  const session = await connect(server, user)
  sessions.push(session)
  return session
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
})

interface TwoMemberRoom {
  host: TestUser
  member: TestUser
  roomId: string
  roomCode: string
  hostSocket: RealtimeSession
}

/** Host and member hold Membership; only the host is connected to the room channel. */
async function twoMemberRoom(): Promise<TwoMemberRoom> {
  server = await buildTestServer()
  const [host, member] = await signInMany(server, 2)
  const game = await insertGame(server)
  const room = await createRoom(server, host!, { gameId: game.id })
  await joinAll(server, room.code, [member!])
  const hostSocket = await open(host!)
  await joinRoomChannel(hostSocket, room.code)
  return { host: host!, member: member!, roomId: room.id, roomCode: room.code, hostSocket }
}

async function openMemberTab(room: TwoMemberRoom): Promise<RealtimeSession> {
  const tab = await open(room.member)
  await joinRoomChannel(tab, room.roomCode)
  expect((await room.hostSocket.next()).type).toBe('player_joined')
  return tab
}

function viewerLeft(room: TwoMemberRoom) {
  return {
    type: 'viewer_left',
    timestamp: expect.any(Number),
    payload: { playerId: room.member.id, roomCode: room.roomCode },
  }
}

describe('graceful disconnect', () => {
  it('closes with 1000, unregisters the socket and emits viewer_left once', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    await subscribeCatalog(tab)

    tab.client.close(NORMAL_CLOSURE)

    expect((await tab.serverClosed).code).toBe(NORMAL_CLOSURE)
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(1)
    expect(subscriptionState(server).catalogSubscribers()).toBe(0)
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room)])
    expect(await countMembers(server, room.roomId)).toBe(2)
  })

  it('drops the room entry and broadcasts nothing when the last socket leaves', async () => {
    const room = await twoMemberRoom()

    room.hostSocket.client.close(NORMAL_CLOSURE)
    await room.hostSocket.serverClosed

    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })

  it('cleans a guest catalog subscription on close', async () => {
    server = await buildTestServer()
    const guest = await open(null)
    await subscribeCatalog(guest)

    guest.client.close(NORMAL_CLOSURE)
    await guest.serverClosed

    expect(subscriptionState(server).catalogSubscribers()).toBe(0)
  })
})

describe('abnormal disconnect', () => {
  it('treats a dropped connection (1006) like a graceful close', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    await subscribeCatalog(tab)

    tab.client.terminate()

    expect((await tab.serverClosed).code).toBe(ABNORMAL_CLOSURE)
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(1)
    expect(subscriptionState(server).catalogSubscribers()).toBe(0)
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room)])
    expect(await countMembers(server, room.roomId)).toBe(2)
  })

  it('closes every socket without a status code (1005) when the server shuts down', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)

    await server.app.close()

    expect((await tab.clientClosed).code).toBe(NO_STATUS_RECEIVED)
    expect((await room.hostSocket.clientClosed).code).toBe(NO_STATUS_RECEIVED)
    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })
})

describe('Membership / Presence conflation', () => {
  it('emits viewer_left when one of several tabs of the same member closes', async () => {
    const room = await twoMemberRoom()
    const firstTab = await openMemberTab(room)
    await openMemberTab(room)

    firstTab.client.close(NORMAL_CLOSURE)
    await firstTab.serverClosed

    // REPLACED BY CCC-37: Presence is per socket, so the member looks gone while another
    // tab is still connected. Closing one of multiple tabs must not emit offline.
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room)])
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(2)
  })

  it('announces a WS leave_room as player_left although Membership is untouched', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)

    tab.send({ type: 'leave_room', payload: { roomCode: room.roomCode } })
    expect(await tab.drain()).toEqual([])

    // REPLACED BY CCC-37: `player_left` reads as a Membership change, but leaving the
    // room channel only affects Presence; the durable Membership is still there.
    expect(await room.hostSocket.drain()).toEqual([
      { type: 'player_left', timestamp: expect.any(Number), payload: { playerId: room.member.id } },
    ])
    expect(await countMembers(server, room.roomId)).toBe(2)

    tab.client.close(NORMAL_CLOSURE)
    await tab.serverClosed
    expect(await room.hostSocket.drain()).toEqual([])
  })

  it('keeps a socket subscribed to the room after its Membership is removed over HTTP', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)

    const response = await roomAction(server, room.member, room.roomCode, 'leave')
    expect(response.statusCode).toBe(200)

    // REPLACED BY CCC-37: the durable leave is not announced to the room channel and the
    // former member keeps receiving room events until their socket goes away.
    expect(await countMembers(server, room.roomId)).toBe(1)
    expect(await room.hostSocket.drain()).toEqual([])
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(2)

    tab.client.close(NORMAL_CLOSURE)
    await tab.serverClosed
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room)])
  })
})
