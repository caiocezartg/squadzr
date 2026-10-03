import type { Room } from '@domain/entities/room.entity'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import { toPublicRoom, toUserNotificationDto } from '@application/projections'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import type { WsConnectionManager } from './ws-connection-manager'
import type {
  NotificationMessage,
  RoomCreatedMessage,
  RoomUpdatedMessage,
  RoomDeletedMessage,
} from './types'

export class WsRoomBroadcaster implements IRoomBroadcaster {
  constructor(private readonly connectionManager: WsConnectionManager) {}

  broadcastRoomCreated(room: Room): void {
    const message: RoomCreatedMessage = {
      type: 'room_created',
      timestamp: Date.now(),
      payload: { room: toPublicRoom(room) },
    }
    this.connectionManager.broadcastToLobby(message)
  }

  broadcastRoomUpdated(roomId: string, roomCode: string, memberCount: number): void {
    const message: RoomUpdatedMessage = {
      type: 'room_updated',
      timestamp: Date.now(),
      payload: { roomId, roomCode, memberCount },
    }
    this.connectionManager.broadcastToLobby(message)
  }

  broadcastRoomDeleted(roomId: string, roomCode: string): void {
    const message: RoomDeletedMessage = {
      type: 'room_deleted',
      timestamp: Date.now(),
      payload: { roomId, roomCode },
    }
    this.connectionManager.broadcastToRoomAndLobby(roomCode, message)
  }

  broadcastNotification(notification: UserNotification, discordLink: string | null): void {
    const message: NotificationMessage = {
      type: 'notification',
      timestamp: Date.now(),
      payload: { notification: toUserNotificationDto(notification, discordLink) },
    }
    this.connectionManager.broadcastToUser(notification.userId, message)
  }
}
