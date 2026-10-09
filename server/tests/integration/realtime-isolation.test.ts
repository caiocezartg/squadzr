import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorMessageSchema, roomSnapshotMessageSchema } from '@squadzr/schemas/ws'
import { buildApp } from '@/app'
import type { WsRoomBroadcaster } from '@infrastructure/websocket/room-broadcaster.service'
import { SOCKET_OPERATION_LIMIT } from '@infrastructure/websocket/ws.plugin'
import { signInMany } from '@test/harness/auth'
import { FakeClock } from '@test/harness/clock'
import { createLogCapture } from '@test/harness/logging'
import {
  connect,
  joinRoomChannel,
  subscribeCatalog,
  subscriptionState,
  type RealtimeSession,
} from '@test/harness/realtime'
import { createRoom, insertGame, joinAll, roomAction } from '@test/harness/rooms'
import { buildTestServer, createTestEnv, type TestServer } from '@test/harness/test-server'

const LATENCY_BOUND_MS = 500
let database: TestServer
let server: TestServer
const sessions: RealtimeSession[] = []

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function withinBound<T>(promise: Promise<T>): Promise<T> {
  const start = performance.now()
  let timer!: ReturnType<typeof setTimeout>
  try {
    const value = await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Exceeded ${LATENCY_BOUND_MS}ms latency bound`)),
          LATENCY_BOUND_MS
        )
      }),
    ])
    expect(performance.now() - start).toBeLessThan(LATENCY_BOUND_MS)
    return value
  } finally {
    clearTimeout(timer)
  }
}

async function open(user: Parameters<typeof connect>[1]) {
  const session = await connect(server, user)
  sessions.push(session)
  return session
}

async function setup() {
  const clock = new FakeClock(new Date())
  const capture = createLogCapture()
  database = await buildTestServer()
  await database.app.close()
  const app = await buildApp({
    env: createTestEnv({ DATABASE_URL: database.databaseUrl }),
    logger: capture.logger,
    clock,
  })
  await app.ready()
  server = { app, databaseUrl: database.databaseUrl, close: () => app.close() }
  const [host, member, otherHost] = await signInMany(server, 3)
  const game = await insertGame(server, 4)
  const room = await createRoom(server, host!, { gameId: game.id, maxPlayers: 4 })
  const otherRoom = await createRoom(server, otherHost!, { gameId: game.id, maxPlayers: 4 })
  const broadcaster = server.app.broadcaster as WsRoomBroadcaster
  return {
    host: host!,
    member: member!,
    otherHost: otherHost!,
    room,
    otherRoom,
    broadcaster,
    clock,
    capture,
  }
}

afterEach(async () => {
  for (const session of sessions.splice(0)) session.client.terminate()
  await server?.close()
  await database?.close()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('realtime isolation under subscription load', () => {
  it.each(['same room', 'different room'])(
    'bounds another socket snapshot and heartbeat in the %s',
    async (target) => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
      const { host, member, otherHost, room, otherRoom, broadcaster, clock, capture } =
        await setup()
      await joinAll(server, room.code, [member])
      const attacker = await open(host)
      const peer = await open(target === 'same room' ? member : otherHost)
      const snapshots = broadcaster['snapshots']
      const subscribe = snapshots.subscribe.bind(snapshots)
      const gate = deferred()
      const started = deferred()
      const spy = vi.spyOn(snapshots, 'subscribe').mockImplementation(async (code, userId) => {
        const snapshot = await subscribe(code, userId)
        if (userId === host.id) {
          started.resolve()
          await gate.promise
        }
        return snapshot
      })
      try {
        const requests = SOCKET_OPERATION_LIMIT * 8
        for (let i = 0; i < requests; i++)
          attacker.send({ type: 'join_room', payload: { roomCode: room.code } })
        await started.promise
        const rejected = await withinBound(
          Promise.all(
            Array.from({ length: requests - SOCKET_OPERATION_LIMIT }, () => attacker.next())
          )
        )
        for (const reply of rejected)
          expect(errorMessageSchema.parse(reply).payload.code).toBe('TOO_MANY_REQUESTS')
        expect(spy.mock.calls.filter(([, userId]) => userId === host.id)).toHaveLength(1)
        expect(
          (
            await withinBound(
              joinRoomChannel(peer, target === 'same room' ? room.code : otherRoom.code)
            )
          ).type
        ).toBe('room_snapshot')
        for (const connection of [peer, attacker]) {
          connection.send({ type: 'ping' })
          expect((await withinBound(connection.next())).type).toBe('pong')
        }
        const attackerPong = vi.spyOn(attacker.client, 'pong')
        const peerPong = vi.spyOn(peer.client, 'pong')
        clock.advance(20_000)
        await withinBound(vi.advanceTimersByTimeAsync(1_000))
        expect(attackerPong).toHaveBeenCalledTimes(1)
        expect(peerPong).toHaveBeenCalledTimes(1)
        const logs = capture.lines.map((line) => JSON.parse(line) as Record<string, unknown>)
        expect(logs.filter((log) => log.event === 'operation_limit')).toHaveLength(
          requests - SOCKET_OPERATION_LIMIT
        )
        expect(logs).toContainEqual(
          expect.objectContaining({
            level: 40,
            category: 'transport',
            event: 'operation_limit',
            code: 'TOO_MANY_REQUESTS',
            connectionId: expect.any(String),
            inFlight: SOCKET_OPERATION_LIMIT,
            limit: SOCKET_OPERATION_LIMIT,
          })
        )
        expect(capture.lines.join('\n')).not.toContain(host.headers.cookie)
        expect(attacker.server.readyState).toBe(attacker.server.OPEN)
        expect(peer.server.readyState).toBe(peer.server.OPEN)
      } finally {
        gate.resolve()
      }
      const accepted = await attacker.drain()
      expect(accepted.filter((message) => message.type === 'room_snapshot')).toHaveLength(
        SOCKET_OPERATION_LIMIT
      )
      expect(spy.mock.calls.filter(([, userId]) => userId === host.id)).toHaveLength(
        SOCKET_OPERATION_LIMIT
      )
      expect((await joinRoomChannel(attacker, room.code)).type).toBe('room_snapshot')
    }
  )

  it('keeps another room publication and member channel moving during a stalled catalog read', async () => {
    const { host, otherHost, room, otherRoom, broadcaster } = await setup()
    const first = await open(host)
    const peer = await open(otherHost)
    await joinRoomChannel(first, room.code)
    await joinRoomChannel(peer, otherRoom.code)
    await subscribeCatalog(peer)
    const snapshots = broadcaster['snapshots']
    const read = snapshots.read.bind(snapshots)
    const gate = deferred()
    const started = deferred()
    vi.spyOn(snapshots, 'read').mockImplementation(async (code) => {
      if (code === room.code) {
        started.resolve()
        await gate.promise
      }
      return read(code)
    })
    try {
      broadcaster.broadcastRoomUpdated(room.id, room.code)
      await started.promise
      broadcaster.broadcastRoomUpdated(otherRoom.id, otherRoom.code)
      const snapshot = roomSnapshotMessageSchema.parse(await withinBound(peer.next()))
      expect(snapshot.payload.room.code).toBe(otherRoom.code)
      expect(await withinBound(peer.next())).toMatchObject({
        type: 'room_updated',
        payload: { roomCode: otherRoom.code },
      })
      expect((await withinBound(joinRoomChannel(peer, otherRoom.code))).type).toBe('room_snapshot')
      peer.send({ type: 'ping' })
      expect((await withinBound(peer.next())).type).toBe('pong')
    } finally {
      gate.resolve()
    }
    expect((await first.drain()).map((message) => message.type)).toEqual(['room_snapshot'])
    expect(await peer.drain()).toEqual([
      expect.objectContaining({
        type: 'room_updated',
        payload: expect.objectContaining({ roomCode: room.code }),
      }),
    ])
  })

  it('delivers a committed snapshot after a pending initial subscription without losing the publication', async () => {
    const { host, member, room, broadcaster } = await setup()
    const channel = await open(host)
    const snapshots = broadcaster['snapshots']
    const subscribe = snapshots.subscribe.bind(snapshots)
    const gate = deferred()
    const started = deferred()
    vi.spyOn(snapshots, 'subscribe').mockImplementation(async (code, userId) => {
      const snapshot = await subscribe(code, userId)
      started.resolve()
      await gate.promise
      return snapshot
    })
    try {
      channel.send({ type: 'join_room', payload: { roomCode: room.code.toLowerCase() } })
      await started.promise
      await joinAll(server, room.code, [member])
      channel.send({ type: 'ping' })
      expect((await withinBound(channel.next())).type).toBe('pong')
    } finally {
      gate.resolve()
    }
    const messages = await channel.drain()
    expect(messages.map((message) => message.type)).toEqual(['room_snapshot', 'room_snapshot'])
    expect(roomSnapshotMessageSchema.parse(messages[0]).payload.players).toHaveLength(1)
    expect(roomSnapshotMessageSchema.parse(messages[1]).payload.players).toHaveLength(2)
    expect(broadcaster['subscriptions'].size).toBe(0)
  })

  it('keeps Presence behind a resubscription snapshot while other connections subscribe immediately', async () => {
    const { host, member, room, broadcaster } = await setup()
    await joinAll(server, room.code, [member])
    const channel = await open(host)
    const peer = await open(member)
    await joinRoomChannel(channel, room.code)
    const snapshots = broadcaster['snapshots']
    const subscribe = snapshots.subscribe.bind(snapshots)
    const gate = deferred()
    const started = deferred()
    vi.spyOn(snapshots, 'subscribe').mockImplementation(async (code, userId) => {
      const snapshot = await subscribe(code, userId)
      if (userId === host.id) {
        started.resolve()
        await gate.promise
      }
      return snapshot
    })
    try {
      channel.send({ type: 'join_room', payload: { roomCode: room.code } })
      await started.promise
      expect((await withinBound(joinRoomChannel(peer, room.code))).type).toBe('room_snapshot')
      channel.send({ type: 'ping' })
      expect((await withinBound(channel.next())).type).toBe('pong')
    } finally {
      gate.resolve()
    }
    expect((await channel.drain()).map((message) => message.type)).toEqual([
      'room_snapshot',
      'presence_updated',
    ])
  })

  it('publishes to a healthy subscriber in the same room while another socket resubscribes slowly', async () => {
    const { host, member, otherHost, room, broadcaster } = await setup()
    await joinAll(server, room.code, [member])
    const channel = await open(host)
    const peer = await open(member)
    await joinRoomChannel(channel, room.code)
    await joinRoomChannel(peer, room.code)
    await channel.drain()
    const snapshots = broadcaster['snapshots']
    const subscribe = snapshots.subscribe.bind(snapshots)
    const gate = deferred()
    const started = deferred()
    vi.spyOn(snapshots, 'subscribe').mockImplementation(async (code, userId) => {
      const snapshot = await subscribe(code, userId)
      started.resolve()
      await gate.promise
      return snapshot
    })
    try {
      channel.send({ type: 'join_room', payload: { roomCode: room.code } })
      await started.promise
      await joinAll(server, room.code, [otherHost])
      const published = roomSnapshotMessageSchema.parse(await withinBound(peer.next()))
      expect(published.payload.players).toHaveLength(3)
      peer.send({ type: 'ping' })
      expect((await withinBound(peer.next())).type).toBe('pong')
    } finally {
      gate.resolve()
    }
    const messages = await channel.drain()
    expect(messages.map((message) => message.type)).toEqual(['room_snapshot', 'room_snapshot'])
    expect(roomSnapshotMessageSchema.parse(messages[0]).payload.players).toHaveLength(2)
    expect(roomSnapshotMessageSchema.parse(messages[1]).payload.players).toHaveLength(3)
  })

  it('orders deletion after a pending initial snapshot and leaves no room subscription behind', async () => {
    const { host, room, broadcaster } = await setup()
    const channel = await open(host)
    const snapshots = broadcaster['snapshots']
    const subscribe = snapshots.subscribe.bind(snapshots)
    const gate = deferred()
    const started = deferred()
    vi.spyOn(snapshots, 'subscribe').mockImplementation(async (code, userId) => {
      const snapshot = await subscribe(code, userId)
      started.resolve()
      await gate.promise
      return snapshot
    })
    try {
      channel.send({ type: 'join_room', payload: { roomCode: room.code } })
      await started.promise
      expect((await roomAction(server, host, room.code, 'leave')).statusCode).toBe(200)
      channel.send({ type: 'ping' })
      expect((await withinBound(channel.next())).type).toBe('pong')
    } finally {
      gate.resolve()
    }
    expect((await channel.drain()).map((message) => message.type)).toEqual([
      'room_snapshot',
      'room_deleted',
    ])
    expect(subscriptionState(server).roomSockets(room.code)).toBe(0)
    expect(broadcaster['subscriptions'].size).toBe(0)
    expect(broadcaster['presence'].isOnline(room.code, host.id)).toBe(false)
  })

  it('preserves a new member Presence when an older roster read finishes after their subscription', async () => {
    const { host, member, room, broadcaster } = await setup()
    const observer = await open(host)
    await joinRoomChannel(observer, room.code)
    const snapshots = broadcaster['snapshots']
    const read = snapshots.read.bind(snapshots)
    const gate = deferred()
    const started = deferred()
    vi.spyOn(snapshots, 'read').mockImplementationOnce(async (code) => {
      const stale = await read(code)
      started.resolve()
      await gate.promise
      return stale
    })
    try {
      broadcaster.broadcastRoomUpdated(room.id, room.code)
      await started.promise
      await joinAll(server, room.code, [member])
      const newcomer = await open(member)
      const snapshot = roomSnapshotMessageSchema.parse(
        await withinBound(joinRoomChannel(newcomer, room.code))
      )
      expect(snapshot.payload.presence).toContainEqual({ playerId: member.id, online: true })
      expect(broadcaster['presence'].isOnline(room.code, member.id)).toBe(true)
    } finally {
      gate.resolve()
    }
    const published = (await observer.drain()).filter((message) => message.type === 'room_snapshot')
    expect(published).toHaveLength(2)
    expect(roomSnapshotMessageSchema.parse(published[0]).payload.players).toHaveLength(1)
    expect(roomSnapshotMessageSchema.parse(published[1]).payload.presence).toContainEqual({
      playerId: member.id,
      online: true,
    })
    expect(broadcaster['presence'].isOnline(room.code, member.id)).toBe(true)
  })

  it('orders created before updated catalog events for a member socket with another channel pending', async () => {
    const { host, room, broadcaster } = await setup()
    const channel = await open(host)
    await joinRoomChannel(channel, room.code)
    await subscribeCatalog(channel)
    const snapshot = await broadcaster['snapshots'].read(room.code)
    if (!snapshot) throw new Error('Expected room snapshot')
    const gate = deferred()
    const pending = broadcaster['operations'].run(() => gate.promise, channel.server, room.code)
    try {
      broadcaster.broadcastRoomCreated(snapshot.room)
      broadcaster.broadcastRoomUpdated(room.id, room.code)
      expect((await withinBound(channel.next())).type).toBe('room_created')
      expect((await withinBound(channel.next())).type).toBe('room_snapshot')
      expect((await withinBound(channel.next())).type).toBe('room_updated')
    } finally {
      gate.resolve()
      await pending
    }
    expect(await channel.drain()).toEqual([])
  })
})
