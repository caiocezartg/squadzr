import type { WebSocket } from '@fastify/websocket'
import type { FastifyBaseLogger } from 'fastify'
import type { Room } from '@domain/entities/room.entity'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import type { Clock } from '@domain/services/clock.interface'
import { toMemberRoom, toPublicRoom, toUserNotificationDto } from '@application/projections'
import type {
  IGetRealtimeSnapshotUseCase,
  RealtimeSnapshot,
} from '@application/use-cases/room/get-realtime-snapshot.use-case'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import type { WsConnectionManager } from './ws-connection-manager'
import type { Presence } from './presence'
import type { OrderedOperations } from './ordered-operations'

export class WsRoomBroadcaster implements IRoomBroadcaster {
  private stopped = false

  constructor(
    private readonly connectionManager: WsConnectionManager,
    private readonly snapshots: IGetRealtimeSnapshotUseCase,
    private readonly presence: Presence,
    private readonly operations: OrderedOperations,
    private readonly clock: Clock,
    private readonly log: FastifyBaseLogger
  ) {}

  broadcastRoomCreated(room: Room): void {
    this.publish(() =>
      this.connectionManager.broadcastToLobby({
        type: 'room_created',
        timestamp: this.clock.now().getTime(),
        payload: { room: toPublicRoom(room) },
      })
    )
  }

  broadcastRoomUpdated(roomId: string, roomCode: string, _memberCount: number): void {
    this.publish(async () => {
      const snapshot = await this.snapshots.read(roomCode)
      if (this.stopped) return
      if (!snapshot) {
        this.deleteRoom(roomId, roomCode)
        return
      }
      this.revokeNonMembers(snapshot)
      this.log.info(
        {
          category: 'membership',
          event: 'snapshot',
          roomId,
          memberCount: snapshot.players.length,
          ready: !!snapshot.room.readyAt,
        },
        'Realtime Membership snapshot'
      )
      for (const socket of this.connectionManager.getRoomSockets(roomCode) ?? [])
        this.sendSnapshot(socket, snapshot)
      this.publishCatalogHint(snapshot)
    })
  }

  private revokeNonMembers({ room, players }: RealtimeSnapshot): void {
    const userIds = new Set(players.map((player) => player.id))
    // Revocation happens before another private snapshot is sent.
    for (const socket of this.connectionManager.getRoomSockets(room.code) ?? []) {
      const client = this.connectionManager.getClientData(socket)
      if (client?.userId && !userIds.has(client.userId)) {
        this.connectionManager.removeFromRoom(room.code, socket)
        client.roomCode = null
        this.connectionManager.sendToSocket(socket, {
          type: 'error',
          timestamp: this.clock.now().getTime(),
          payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this room' },
        })
      }
    }
    this.presence.retainMembers(room.code, userIds)
  }

  private publishCatalogHint({ room, players }: RealtimeSnapshot): void {
    const timestamp = this.clock.now().getTime()
    const payload = { roomId: room.id, roomCode: room.code }
    this.connectionManager.broadcastToLobby(
      room.readyAt
        ? { type: 'room_removed', timestamp, payload }
        : { type: 'room_updated', timestamp, payload: { ...payload, memberCount: players.length } }
    )
  }

  broadcastRoomDeleted(roomId: string, roomCode: string): void {
    this.publish(() => this.deleteRoom(roomId, roomCode))
  }

  private deleteRoom(roomId: string, roomCode: string): void {
    const timestamp = this.clock.now().getTime()
    this.connectionManager.broadcastToRoom(roomCode, {
      type: 'room_deleted',
      timestamp,
      payload: { roomId, roomCode },
    })
    this.connectionManager.broadcastToLobby({
      type: 'room_removed',
      timestamp,
      payload: { roomId, roomCode },
    })
    this.connectionManager.deleteRoom(roomCode)
    this.presence.deleteRoom(roomCode)
  }

  broadcastNotification(notification: UserNotification, discordLink: string | null): void {
    const recipients = [...(this.connectionManager.getUserSockets(notification.userId) ?? [])]
    this.publish(() => {
      for (const socket of recipients)
        this.connectionManager.sendToSocket(socket, {
          type: 'notification',
          timestamp: this.clock.now().getTime(),
          payload: { notification: toUserNotificationDto(notification, discordLink) },
        })
    })
  }

  sendSnapshot(socket: WebSocket, snapshot: RealtimeSnapshot): void {
    const { room, players } = snapshot
    this.connectionManager.sendToSocket(socket, {
      type: 'room_snapshot',
      timestamp: this.clock.now().getTime(),
      payload: {
        room: toMemberRoom({ ...room, memberCount: players.length }),
        players,
        readyAt: room.readyAt?.toISOString() ?? null,
        expiresAt: snapshot.expiresAt.toISOString(),
        presence: players.map((player) => ({
          playerId: player.id,
          online: this.presence.isOnline(room.code, player.id),
        })),
      },
    })
  }

  broadcastPresence(
    roomCode: string,
    playerId: string,
    online: boolean,
    excludeSocket?: WebSocket
  ): void {
    if (this.stopped) return
    this.log.info(
      { category: 'presence', event: 'transition', roomCode, userId: playerId, online },
      'Realtime Presence transition'
    )
    this.connectionManager.broadcastToRoom(
      roomCode,
      {
        type: 'presence_updated',
        timestamp: this.clock.now().getTime(),
        payload: { roomCode, playerId, online },
      },
      excludeSocket
    )
  }

  stop(): void {
    this.stopped = true
  }

  private publish(operation: () => void | Promise<void>): void {
    void this.operations
      .run(async () => {
        if (!this.stopped) await operation()
      })
      .catch(() => {
        this.log.error(
          { category: 'membership', event: 'publication_failed' },
          'Realtime publication failed'
        )
      })
  }
}
