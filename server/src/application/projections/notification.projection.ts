import type { UserNotificationDto } from '@squadzr/schemas'
import type { UserNotification } from '@domain/entities/user-notification.entity'

/**
 * Notification as its owner sees it; never sent to anyone but `notification.userId`.
 * `discordLink` is resolved at read time through the retained room, never stored.
 */
export function toUserNotificationDto(
  notification: UserNotification,
  discordLink: string | null
): UserNotificationDto {
  return {
    id: notification.id,
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    payload: {
      roomId: notification.payload.roomId,
      roomCode: notification.payload.roomCode,
      roomName: notification.payload.roomName,
      gameName: notification.payload.gameName,
      players: notification.payload.players.map((player) => ({
        name: player.name,
        image: player.image,
      })),
      discordLink,
    },
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}
