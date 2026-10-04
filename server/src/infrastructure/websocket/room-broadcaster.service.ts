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
  private readonly subscriptions = new Map<string, Map<WebSocket, number>>()

  constructor(
    private readonly connectionManager: WsConnectionManager,
    private readonly snapshots: IGetRealtimeSnapshotUseCase,
    private readonly presence: Presence,
    private readonly operations: OrderedOperations,
    private readonly clock: Clock,
    private readonly log: FastifyBaseLogger
  ) {}

  /** Reserve the socket's place before the asynchronous Membership check starts. */
  scheduleSubscription(
    socket: WebSocket,
    roomCode: string,
    operation: () => Promise<void>
  ): Promise<void> {
    let sockets = this.subscriptions.get(roomCode)
    if (!sockets) {
      sockets = new Map()
      this.subscriptions.set(roomCode, sockets)
    }
    sockets.set(socket, (sockets.get(socket) ?? 0) + 1)
    return this.operations.run(operation, socket).finally(() => {
      const count = (sockets.get(socket) ?? 0) - 1
      if (count > 0) sockets.set(socket, count)
      else sockets.delete(socket)
      if (sockets.size === 0) this.subscriptions.delete(roomCode)
    })
  }

  broadcastRoomCreated(room: Room): void {
    for (const socket of this.connectionManager.getLobbySockets())
      this.publish(
        socket,
        () => {
          if (this.connectionManager.getClientData(socket)?.isInLobby)
            this.connectionManager.sendToSocket(socket, {
              type: 'room_created',
              timestamp: this.clock.now().getTime(),
              payload: { room: toPublicRoom(room) },
            })
        },
        room.code
      )
  }

  broadcastRoomUpdated(roomId: string, roomCode: string, _memberCount: number): void {
    if (this.stopped) return
    const pending = this.operations
      .run(async () => {
        if (this.stopped) return
        const snapshot = await this.snapshots.read(roomCode)
        if (this.stopped) return
        if (!snapshot) return null
        this.presence.retainMembers(roomCode, new Set(snapshot.players.map((player) => player.id)))
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
        return snapshot
      }, roomCode)
      .catch(() => {
        this.publicationFailed()
        return undefined
      })
    // Enqueue deliveries now, including sockets whose initial subscription is pending.
    // Reading once per room never waits for a socket's subscription or delivery queue.
    for (const socket of this.roomAndLobbySockets(roomCode))
      this.publish(
        socket,
        async () => {
          const snapshot = await pending
          if (this.stopped || snapshot === undefined) return
          if (!snapshot) {
            this.deleteRoomForSocket(socket, roomId, roomCode)
            return
          }
          if (this.connectionManager.getClientData(socket)?.roomCode === roomCode) {
            this.revokeNonMember(socket, snapshot)
            if (this.connectionManager.getClientData(socket)?.roomCode === roomCode)
              this.sendSnapshot(socket, snapshot)
          }
          this.publishCatalogHint(socket, snapshot)
        },
        this.catalogChannel(socket, roomCode)
      )
  }

  private revokeNonMember(socket: WebSocket, { room, players }: RealtimeSnapshot): void {
    const userIds = new Set(players.map((player) => player.id))
    // Revocation happens before another private snapshot is sent.
    const client = this.connectionManager.getClientData(socket)
    if (client?.userId && !userIds.has(client.userId)) {
      this.connectionManager.removeFromRoom(room.code, socket)
      client.roomCode = null
      this.connectionManager.sendToSocket(socket, {
        type: 'error',
        timestamp: this.clock.now().getTime(),
        payload: { code: 'NOT_ROOM_MEMBER', message: 'You are not a member of this room' },
      })
      this.presence.leave(room.code, client.userId, socket)
    }
  }

  private publishCatalogHint(socket: WebSocket, { room, players }: RealtimeSnapshot): void {
    if (!this.connectionManager.getClientData(socket)?.isInLobby) return
    const timestamp = this.clock.now().getTime()
    const payload = { roomId: room.id, roomCode: room.code }
    this.connectionManager.sendToSocket(
      socket,
      room.readyAt
        ? { type: 'room_removed', timestamp, payload }
        : { type: 'room_updated', timestamp, payload: { ...payload, memberCount: players.length } }
    )
  }

  broadcastRoomDeleted(roomId: string, roomCode: string): void {
    if (this.stopped) return
    const pending = this.operations.run(() => this.presence.deleteRoom(roomCode), roomCode)
    for (const socket of this.roomAndLobbySockets(roomCode))
      this.publish(
        socket,
        async () => {
          await pending
          if (!this.stopped) this.deleteRoomForSocket(socket, roomId, roomCode)
        },
        this.catalogChannel(socket, roomCode)
      )
  }

  private deleteRoomForSocket(socket: WebSocket, roomId: string, roomCode: string): void {
    const timestamp = this.clock.now().getTime()
    const client = this.connectionManager.getClientData(socket)
    if (client?.roomCode === roomCode) {
      this.connectionManager.sendToSocket(socket, {
        type: 'room_deleted',
        timestamp,
        payload: { roomId, roomCode },
      })
      this.connectionManager.removeFromRoom(roomCode, socket)
      client.roomCode = null
    }
    if (client?.isInLobby)
      this.connectionManager.sendToSocket(socket, {
        type: 'room_removed',
        timestamp,
        payload: { roomId, roomCode },
      })
    this.presence.deleteRoom(roomCode)
  }

  broadcastNotification(notification: UserNotification, discordLink: string | null): void {
    const recipients = [...(this.connectionManager.getUserSockets(notification.userId) ?? [])]
    for (const socket of recipients)
      this.publish(socket, () => {
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
    for (const socket of this.connectionManager.getRoomSockets(roomCode) ?? []) {
      if (socket === excludeSocket) continue
      this.publish(socket, () => {
        if (this.connectionManager.getClientData(socket)?.roomCode !== roomCode) return
        this.connectionManager.sendToSocket(socket, {
          type: 'presence_updated',
          timestamp: this.clock.now().getTime(),
          payload: { roomCode, playerId, online },
        })
      })
    }
  }

  stop(): void {
    this.stopped = true
  }

  private roomAndLobbySockets(roomCode: string): Set<WebSocket> {
    return new Set([
      ...(this.connectionManager.getRoomSockets(roomCode) ?? []),
      ...(this.subscriptions.get(roomCode)?.keys() ?? []),
      ...this.connectionManager.getLobbySockets(),
    ])
  }

  private publicationFailed(): void {
    this.log.error(
      { category: 'membership', event: 'publication_failed' },
      'Realtime publication failed'
    )
  }

  /** A catalog-only delivery cannot hold up this socket's unrelated member channel. */
  private catalogChannel(socket: WebSocket, roomCode: string): string | undefined {
    return this.connectionManager.getClientData(socket)?.roomCode === roomCode ||
      this.subscriptions.get(roomCode)?.has(socket)
      ? undefined
      : roomCode
  }

  private publish(
    socket: WebSocket,
    operation: () => void | Promise<void>,
    channel?: string
  ): void {
    if (this.stopped || !this.connectionManager.isConnected(socket)) return
    void this.operations
      .run(
        async () => {
          if (!this.stopped && this.connectionManager.isConnected(socket)) await operation()
        },
        socket,
        channel
      )
      .catch(() => this.publicationFailed())
  }
}
