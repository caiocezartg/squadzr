/**
 * CCC-33 disconnect characterizations updated for CCC-37: durable Membership
 * survives transport loss, sessions share one Presence, and offline waits for
 * the reconnect grace window. HTTP Membership removal revokes the channel.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { roomSnapshotMessageSchema } from '@squadzr/schemas/ws'
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
import { FakeClock } from '@test/harness/clock'

const NORMAL_CLOSURE = 1000
const ABNORMAL_CLOSURE = 1006
const NO_STATUS_RECEIVED = 1005

let server: TestServer
const sessions: RealtimeSession[] = []
let clock: FakeClock

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
  clock = new FakeClock(new Date())
  server = await buildTestServer({}, { clock })
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
  expect((await room.hostSocket.drain()).map((message) => message.type)).toEqual([
    'presence_updated',
  ])
  return tab
}

function viewerLeft(room: TwoMemberRoom, offlineSince: unknown = expect.any(String)) {
  return {
    type: 'presence_updated',
    timestamp: expect.any(Number),
    payload: { playerId: room.member.id, roomCode: room.roomCode, online: false, offlineSince },
  }
}

describe('graceful disconnect', () => {
  it('closes with 1000, unregisters the socket and emits offline once after 10 seconds', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    await subscribeCatalog(tab)
    const closedAt = clock.now().toISOString()

    tab.client.close(NORMAL_CLOSURE)

    expect((await tab.serverClosed).code).toBe(NORMAL_CLOSURE)
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(1)
    expect(subscriptionState(server).catalogSubscribers()).toBe(0)
    expect(await room.hostSocket.drain()).toEqual([])
    clock.advance(9_999)
    await subscriptionState(server).sweepPresence()
    expect(await room.hostSocket.drain()).toEqual([])
    clock.advance(1)
    await subscriptionState(server).sweepPresence()
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room, closedAt)])
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
    expect(await room.hostSocket.drain()).toEqual([])
    clock.advance(10_000)
    await subscriptionState(server).sweepPresence()
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

describe('Membership and multi-session Presence', () => {
  it('does not emit offline when one of several tabs of the same member closes', async () => {
    const room = await twoMemberRoom()
    const firstTab = await openMemberTab(room)
    const secondTab = await open(room.member)
    await joinRoomChannel(secondTab, room.roomCode)

    firstTab.client.close(NORMAL_CLOSURE)
    await firstTab.serverClosed

    clock.advance(10_000)
    await subscriptionState(server).sweepPresence()
    expect(await room.hostSocket.drain()).toEqual([])
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(2)
  })

  it('changes only Presence when leaving the WS channel, keeping Membership', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)

    tab.send({ type: 'leave_room', payload: { roomCode: room.roomCode } })
    expect(await tab.drain()).toEqual([])

    expect(await room.hostSocket.drain()).toEqual([])
    clock.advance(10_000)
    await subscriptionState(server).sweepPresence()
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room)])
    expect(await countMembers(server, room.roomId)).toBe(2)

    tab.client.close(NORMAL_CLOSURE)
    await tab.serverClosed
    expect(await room.hostSocket.drain()).toEqual([])
  })

  it('publishes Membership removal and revokes the former member channel after commit', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)

    const response = await roomAction(server, room.member, room.roomCode, 'leave')
    expect(response.statusCode).toBe(200)

    expect(await countMembers(server, room.roomId)).toBe(1)
    expect(await room.hostSocket.drain()).toEqual([
      expect.objectContaining({
        type: 'room_snapshot',
        payload: expect.objectContaining({
          players: [expect.objectContaining({ id: room.host.id })],
          presence: [{ playerId: room.host.id, online: true, offlineSince: null }],
        }),
      }),
    ])
    expect(subscriptionState(server).roomSockets(room.roomCode)).toBe(1)
    expect(await tab.drain()).toEqual([
      expect.objectContaining({
        type: 'error',
        payload: expect.objectContaining({ code: 'NOT_ROOM_MEMBER' }),
      }),
    ])

    tab.client.close(NORMAL_CLOSURE)
    await tab.serverClosed
    clock.advance(10_000)
    await subscriptionState(server).sweepPresence()
    expect(await room.hostSocket.drain()).toEqual([])
  })
})

describe('offlineSince', () => {
  function memberPresence(room: TwoMemberRoom, snapshot: unknown) {
    const { presence } = roomSnapshotMessageSchema.parse(snapshot).payload
    return presence.find((entry) => entry.playerId === room.member.id)
  }

  async function closeAndExpire(room: TwoMemberRoom, tab: RealtimeSession): Promise<string> {
    const closedAt = clock.now().toISOString()
    tab.client.close(NORMAL_CLOSURE)
    await tab.serverClosed
    clock.advance(12_000)
    await subscriptionState(server).sweepPresence()
    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room, closedAt)])
    return closedAt
  }

  it('is the close time of the last session, not the end of the grace', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    const first = await open(room.member)
    await joinRoomChannel(first, room.roomCode)
    await room.hostSocket.drain()

    tab.client.close(NORMAL_CLOSURE)
    await tab.serverClosed
    clock.advance(3_000)
    const lastClosedAt = clock.now().toISOString()
    first.client.close(NORMAL_CLOSURE)
    await first.serverClosed
    clock.advance(10_000)
    await subscriptionState(server).sweepPresence()

    expect(await room.hostSocket.drain()).toEqual([viewerLeft(room, lastClosedAt)])
  })

  it('is kept for a snapshot read after the sweep deleted the online entry', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    const closedAt = await closeAndExpire(room, tab)

    clock.advance(60_000)
    const viewer = await open(room.host)
    const snapshot = await joinRoomChannel(viewer, room.roomCode)

    expect(memberPresence(room, snapshot)).toEqual({
      playerId: room.member.id,
      online: false,
      offlineSince: closedAt,
    })
  })

  it('clears when the member comes back online and starts over on the next disconnect', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    await closeAndExpire(room, tab)

    const returned = await open(room.member)
    const snapshot = await joinRoomChannel(returned, room.roomCode)

    expect(memberPresence(room, snapshot)).toEqual({
      playerId: room.member.id,
      online: true,
      offlineSince: null,
    })
    expect(await room.hostSocket.drain()).toEqual([
      {
        type: 'presence_updated',
        timestamp: expect.any(Number),
        payload: {
          playerId: room.member.id,
          roomCode: room.roomCode,
          online: true,
          offlineSince: null,
        },
      },
    ])
    await closeAndExpire(room, returned)
  })

  it('is removed when the Membership ends, so a later Membership has no known time', async () => {
    const room = await twoMemberRoom()
    const tab = await openMemberTab(room)
    await closeAndExpire(room, tab)

    expect((await roomAction(server, room.member, room.roomCode, 'leave')).statusCode).toBe(200)
    await room.hostSocket.drain()
    await joinAll(server, room.roomCode, [room.member])

    const [snapshot] = await room.hostSocket.drain()
    expect(memberPresence(room, snapshot)).toEqual({
      playerId: room.member.id,
      online: false,
      offlineSince: null,
    })
  })

  it('is null for a member the server has never seen', async () => {
    const room = await twoMemberRoom()
    const viewer = await open(room.host)

    const snapshot = await joinRoomChannel(viewer, room.roomCode)

    expect(memberPresence(room, snapshot)).toEqual({
      playerId: room.member.id,
      online: false,
      offlineSince: null,
    })
  })
})
