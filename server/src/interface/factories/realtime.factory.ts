import type { FastifyBaseLogger } from 'fastify'
import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { GetRealtimeSnapshotUseCase } from '@application/use-cases/room/get-realtime-snapshot.use-case'
import { WsConnectionManager } from '@infrastructure/websocket/ws-connection-manager'
import { WsRoomBroadcaster } from '@infrastructure/websocket/room-broadcaster.service'
import { OrderedOperations } from '@infrastructure/websocket/ordered-operations'
import { Presence } from '@infrastructure/websocket/presence'
import { Heartbeat } from '@infrastructure/websocket/heartbeat'
import { handleDisconnect } from '@infrastructure/websocket/handlers/room.handler'
import type { WebSocket } from '@fastify/websocket'
import type { Realtime } from '@infrastructure/websocket/types'

export function createRealtime(db: Database, clock: Clock, log: FastifyBaseLogger): Realtime {
  const operations = new OrderedOperations()
  const snapshots = new GetRealtimeSnapshotUseCase(
    new DrizzleRoomRepository(db),
    new DrizzleRoomMemberRepository(db, clock),
    new DrizzleUserRepository(db),
    clock
  )
  const manager = new WsConnectionManager((socket) => {
    log.warn({ category: 'transport', event: 'send_failed' }, 'WebSocket send failed')
    disconnect(socket)
    socket.terminate()
  })
  const presence = new Presence(clock, (roomCode, userId, online) =>
    broadcaster.broadcastPresence(roomCode, userId, online)
  )
  const broadcaster = new WsRoomBroadcaster(manager, snapshots, presence, operations, clock, log)
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
  let stopped = false

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
    snapshots,
    presence,
    broadcaster,
    heartbeat,
    operations,
    disconnect,
    sweep,
    shutdown,
    isStopped: () => stopped,
  }
}
