import type { FastifyBaseLogger } from 'fastify'
import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { DrizzleActiveSessions } from '@infrastructure/services/drizzle-active-sessions'
import { GetRealtimeSnapshotUseCase } from '@application/use-cases/room/get-realtime-snapshot.use-case'
import { GetRoomByCodeUseCase } from '@application/use-cases/room/get-room-by-code.use-case'
import { SubscribeRealtimeSnapshotUseCase } from '@application/use-cases/room/subscribe-realtime-snapshot.use-case'
import { WsConnectionManager } from '@infrastructure/websocket/ws-connection-manager'
import { WsRoomBroadcaster } from '@infrastructure/websocket/room-broadcaster.service'
import { OrderedOperations } from '@infrastructure/websocket/ordered-operations'
import { Presence } from '@infrastructure/websocket/presence'
import { Heartbeat } from '@infrastructure/websocket/heartbeat'
import { handleDisconnect } from '@infrastructure/websocket/handlers/room.handler'
import type { WebSocket } from '@fastify/websocket'
import type { ConnectionInspection, Realtime } from '@infrastructure/websocket/types'

/** How often the live sockets' sign-in sessions are checked. */
const SESSION_CHECK_INTERVAL_MS = 30_000
/** Close code of a socket whose session ended; not terminal, so the app reconnects as a visitor. */
const SESSION_ENDED_CLOSE_CODE = 4001

export function createRealtime(db: Database, clock: Clock, log: FastifyBaseLogger): Realtime {
  const operations = new OrderedOperations()
  const rooms = new DrizzleRoomRepository(db, clock)
  const members = new DrizzleRoomMemberRepository(db, clock)
  const users = new DrizzleUserRepository(db)
  const getRoomByCode = new GetRoomByCodeUseCase(rooms, members, users, clock)
  const subscribeSnapshot = new SubscribeRealtimeSnapshotUseCase(getRoomByCode)
  const getSnapshot = new GetRealtimeSnapshotUseCase(rooms, members, users, clock)
  const manager = new WsConnectionManager((socket) => {
    log.warn({ category: 'transport', event: 'send_failed' }, 'WebSocket send failed')
    disconnect(socket)
    socket.terminate()
  })
  const presence = new Presence(clock, (roomCode, userId, online) =>
    broadcaster.broadcastPresence(roomCode, userId, online)
  )
  const broadcaster = new WsRoomBroadcaster(manager, getSnapshot, presence, operations, clock, log)
  const heartbeat = new Heartbeat(clock, (socket) => {
    log.warn(
      {
        category: 'transport',
        event: 'heartbeat_timeout',
        connectionCount: manager.connectionCount,
      },
      'WebSocket heartbeat timeout'
    )
    disconnect(socket)
  })
  const activeSessions = new DrizzleActiveSessions(db, clock)
  let stopped = false
  let lastSessionCheck = clock.now().getTime()
  let checkingSessions = false

  const inspect: ConnectionInspection = {
    catalogSubscribers: () => manager.getLobbySockets().size,
    roomSockets: (roomCode) => manager.getRoomSockets(roomCode)?.size ?? 0,
    trackedRooms: () => manager.roomCount,
  }

  function disconnect(socket: WebSocket): void {
    heartbeat.remove(socket)
    if (handleDisconnect(socket, manager, presence)) {
      log.info(
        { category: 'transport', event: 'disconnected', connectionCount: manager.connectionCount },
        'WebSocket disconnected'
      )
    }
  }

  async function sweep(): Promise<void> {
    if (stopped) return
    // Transport liveness must continue even while a database-backed snapshot waits.
    heartbeat.sweep()
    presence.sweep()
    if (clock.now().getTime() - lastSessionCheck >= SESSION_CHECK_INTERVAL_MS) {
      lastSessionCheck = clock.now().getTime()
      await revalidateSessions()
    }
  }

  async function revalidateSessions(): Promise<void> {
    if (stopped || checkingSessions) return
    const sockets = manager.sessionSockets()
    if (sockets.length === 0) return
    checkingSessions = true
    try {
      const active = await activeSessions.findActive([...new Set(sockets.map((s) => s.sessionId))])
      for (const { socket, sessionId } of sockets) {
        if (active.has(sessionId) || !manager.isConnected(socket)) continue
        log.info({ category: 'transport', event: 'session_ended' }, 'WebSocket session ended')
        disconnect(socket)
        socket.close(SESSION_ENDED_CLOSE_CODE, 'Session ended')
      }
    } finally {
      checkingSessions = false
    }
  }

  async function shutdown(): Promise<void> {
    stopped = true
    broadcaster.stop()
    heartbeat.clear()
    manager.clear()
    presence.clear()
    log.info(
      { category: 'transport', event: 'shutdown', connectionCount: manager.connectionCount },
      'Realtime shutdown'
    )
    await operations.drain()
  }

  return {
    manager,
    subscribeSnapshot,
    getSnapshot,
    presence,
    broadcaster,
    heartbeat,
    operations,
    inspect,
    disconnect,
    drain: () => operations.drain(),
    sweep,
    revalidateSessions,
    shutdown,
    isStopped: () => stopped,
  }
}
