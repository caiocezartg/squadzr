import { afterEach, describe, expect, it, vi } from 'vitest'
import { sql } from 'drizzle-orm'
import { roomSnapshotMessageSchema } from '@squadzr/schemas/ws'
import { signInMany } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import { createRoom, insertGame, joinAll, roomAction, setRoomLifecycle } from '@test/harness/rooms'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  subscriptionState,
  type RealtimeSession,
} from '@test/harness/realtime'
import { buildTestServer, type TestServer } from '@test/harness/test-server'
import { runRoomCleanup } from '@infrastructure/plugins/room-cleanup.plugin'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import type { WsRoomBroadcaster } from '@infrastructure/websocket/room-broadcaster.service'

let server: TestServer
const sessions: RealtimeSession[] = []
let clock: FakeClock

async function setup(capacity = 4) {
  clock = new FakeClock(new Date())
  server = await buildTestServer({}, { clock })
  const [host, member, third] = await signInMany(server, 3)
  const game = await insertGame(server, capacity)
  const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: capacity })
  return { host: host!, member: member!, third: third!, room }
}

async function open(user: Parameters<typeof connect>[1] = null) {
  const session = await connect(server, user)
  sessions.push(session)
  return session
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
  vi.useRealTimers()
})

describe('authoritative snapshots and ordered events', () => {
  it('resubscribes with the complete current roster and identical readiness and Presence', async () => {
    const { host, member, room } = await setup()
    await joinAll(server, room.code, [member])
    const session = await open(host)
    const initial = roomSnapshotMessageSchema.parse(await joinRoomChannel(session, room.code))
    const repeated = roomSnapshotMessageSchema.parse(await joinRoomChannel(session, room.code))
    expect(repeated).toEqual(initial)
    expect(repeated.payload.players.map((player) => player.id).sort()).toEqual(
      [host.id, member.id].sort()
    )
    expect(repeated.payload.presence).toEqual([
      { playerId: host.id, online: true },
      { playerId: member.id, online: false },
    ])
    expect(await session.drain()).toEqual([])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)
  })

  it('orders rapid subscribe, unsubscribe and resubscribe messages on the same connection', async () => {
    const { host, room } = await setup()
    const session = await open(host)
    session.send({ type: 'join_room', payload: { roomCode: room.code } })
    session.send({ type: 'leave_room', payload: { roomCode: room.code } })
    session.send({ type: 'join_room', payload: { roomCode: room.code } })
    expect((await session.drain()).map((message) => message.type)).toEqual([
      'room_snapshot',
      'room_snapshot',
    ])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)
  })

  it('publishes committed Membership changes in order and repeats idempotent joins safely', async () => {
    const { host, member, third, room } = await setup()
    const session = await open(host)
    await joinRoomChannel(session, room.code)
    await joinAll(server, room.code, [member])
    const first = roomSnapshotMessageSchema.parse(await session.next())
    await joinAll(server, room.code, [third])
    const second = roomSnapshotMessageSchema.parse(await session.next())
    await joinAll(server, room.code, [third])
    const repeated = roomSnapshotMessageSchema.parse(await session.next())
    expect(first.payload.players).toHaveLength(2)
    expect(second.payload.players).toHaveLength(3)
    expect(repeated.payload).toEqual(second.payload)
    expect(await session.drain()).toEqual([])
  })

  it('sends the committed Ready snapshot and removes only the catalog card', async () => {
    const { host, member, room } = await setup(2)
    const channel = await open(host)
    await joinRoomChannel(channel, room.code)
    await subscribeCatalog(channel)
    const guest = await open()
    await subscribeCatalog(guest)
    await joinAll(server, room.code, [member])
    const messages = await channel.drain()
    expect(messages.map((message) => message.type)).toEqual([
      'room_snapshot',
      'room_removed',
      'notification',
    ])
    expect(roomSnapshotMessageSchema.parse(messages[0]).payload).toMatchObject({
      readyAt: clock.now().toISOString(),
      players: expect.arrayContaining([expect.objectContaining({ id: member.id })]),
    })
    expect(await guest.drain()).toEqual([
      {
        type: 'room_removed',
        timestamp: clock.now().getTime(),
        payload: { roomId: room.id, roomCode: room.code },
      },
    ])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)
    expect((await joinRoomChannel(channel, room.code)).type).toBe('room_snapshot')
  })

  it('sends no room or catalog event when readiness and Membership roll back', async () => {
    const { host, member, room } = await setup(2)
    const channel = await open(host)
    await joinRoomChannel(channel, room.code)
    await subscribeCatalog(channel)
    await server.app.db.execute(
      sql`CREATE FUNCTION reject_realtime_notification() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'forced rollback'; END; $$ LANGUAGE plpgsql`
    )
    await server.app.db.execute(
      sql`CREATE TRIGGER reject_realtime_notification BEFORE INSERT ON user_notifications FOR EACH ROW EXECUTE FUNCTION reject_realtime_notification()`
    )
    const response = await roomAction(server, member, room.code, 'join')
    expect(response.statusCode).toBe(500)
    expect(await channel.drain()).toEqual([])
    const snapshot = roomSnapshotMessageSchema.parse(await joinRoomChannel(channel, room.code))
    expect(snapshot.payload.players).toHaveLength(1)
    expect(snapshot.payload.readyAt).toBeNull()
  })

  it('keeps user-targeted notifications on every authenticated session and excludes other users', async () => {
    const { host, member, third, room } = await setup(2)
    const first = await open(host)
    const second = await open(host)
    const outsider = await open(third)
    await joinAll(server, room.code, [member])
    for (const tab of [first, second]) {
      expect(await tab.drain()).toEqual([
        expect.objectContaining({
          type: 'notification',
          payload: expect.objectContaining({
            notification: expect.objectContaining({ userId: host.id }),
          }),
        }),
      ])
    }
    expect(await outsider.drain()).toEqual([])
    first.client.close(1000)
    await first.serverClosed
    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })

  it('deletes an expired room for members and sends a separate removed catalog hint', async () => {
    const { host, room } = await setup()
    const channel = await open(host)
    await joinRoomChannel(channel, room.code)
    const guest = await open()
    await subscribeCatalog(guest)
    const expired = new Date(clock.now().getTime() - 24 * 60 * 60_000)
    await setRoomLifecycle(server, room.id, {
      createdAt: expired,
      lastActivityAt: expired,
      readyAt: null,
    })
    await runRoomCleanup(
      server.app.log,
      new DeleteExpiredRoomsUseCase(new DrizzleRoomRepository(server.app.db, clock), clock),
      server.app.broadcaster
    )
    expect((await channel.drain()).map((message) => message.type)).toEqual(['room_deleted'])
    expect((await guest.drain()).map((message) => message.type)).toEqual(['room_removed'])
    expect(subscriptionState(server).trackedRooms()).toBe(0)
  })
})

describe('Presence grace and heartbeat wiring', () => {
  it('sends the snapshot first when reconnecting after the grace deadline', async () => {
    const { host, member, room } = await setup()
    await joinAll(server, room.code, [member])
    const observer = await open(host)
    await joinRoomChannel(observer, room.code)
    const tab = await open(member)
    await joinRoomChannel(tab, room.code)
    expect((await observer.next()).type).toBe('presence_updated')
    tab.client.close(1000)
    await tab.serverClosed
    clock.advance(10_000)
    const reconnect = await open(member)
    const snapshot = roomSnapshotMessageSchema.parse(await joinRoomChannel(reconnect, room.code))
    expect(snapshot.payload.presence).toContainEqual({ playerId: member.id, online: true })
    expect(await reconnect.drain()).toEqual([])
    expect(await observer.drain()).toEqual([
      {
        type: 'presence_updated',
        timestamp: clock.now().getTime(),
        payload: { roomCode: room.code, playerId: member.id, online: false },
      },
      {
        type: 'presence_updated',
        timestamp: clock.now().getTime(),
        payload: { roomCode: room.code, playerId: member.id, online: true },
      },
    ])
  })

  it('reconnects within 10 seconds without offline or another online event', async () => {
    const { host, member, room } = await setup()
    await joinAll(server, room.code, [member])
    const observer = await open(host)
    await joinRoomChannel(observer, room.code)
    const tab = await open(member)
    await joinRoomChannel(tab, room.code)
    expect((await observer.next()).type).toBe('presence_updated')
    tab.client.close(1000)
    await tab.serverClosed
    clock.advance(9_999)
    await subscriptionState(server).sweepPresence()
    const reconnect = await open(member)
    const snapshot = roomSnapshotMessageSchema.parse(await joinRoomChannel(reconnect, room.code))
    clock.advance(1)
    await subscriptionState(server).sweepPresence()
    expect(snapshot.payload.presence).toContainEqual({ playerId: member.id, online: true })
    expect(await observer.drain()).toEqual([])
  })

  it('converges a silent transport within 60 seconds using the injected clock and cancels timers on shutdown', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    const { host, member, room } = await setup()
    await joinAll(server, room.code, [member])
    const observer = await open(host)
    await joinRoomChannel(observer, room.code)
    const silent = await open(member)
    await joinRoomChannel(silent, room.code)
    expect((await observer.next()).type).toBe('presence_updated')
    // Browser protocol pongs are automatic; suppress only this session's response.
    vi.spyOn(silent.client, 'pong').mockImplementation(() => {})
    clock.advance(20_000)
    await vi.advanceTimersByTimeAsync(1_000)
    await observer.drain()
    // A stalled DB-backed operation must not stall transport liveness.
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const broadcaster = server.app.broadcaster as WsRoomBroadcaster
    const pending = broadcaster['operations'].run(() => gate)
    try {
      clock.advance(20_000)
      await vi.advanceTimersByTimeAsync(1_000)
      expect(observer.server.readyState).toBe(observer.server.OPEN)
      expect(silent.server.readyState).toBe(silent.server.CLOSED)
      await silent.serverClosed
      clock.advance(10_000)
      await vi.advanceTimersByTimeAsync(1_000)
    } finally {
      release()
      await pending
    }
    expect(await observer.drain()).toEqual([
      {
        type: 'presence_updated',
        timestamp: clock.now().getTime(),
        payload: { roomCode: room.code, playerId: member.id, online: false },
      },
    ])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(1)
    await server.app.close()
    expect(vi.getTimerCount()).toBe(0)
  })
})
