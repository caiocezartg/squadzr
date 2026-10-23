import { userNotificationPayloadSchema, userNotificationTypeSchema } from '@squadzr/schemas'
import type {
  CreateUserNotificationInput,
  UserNotification,
} from '@domain/entities/user-notification.entity'
import type {
  NewUserNotificationRow,
  UserNotificationRow,
} from '@infrastructure/database/schema/user-notifications'

// Persisted payload: the contract payload minus the Discord invite. Unknown keys are
// stripped, so legacy rows that still stored the link do not leak it.
const persistedUserNotificationPayloadSchema = userNotificationPayloadSchema.omit({
  discordLink: true,
})

export function notificationInputToRow(input: CreateUserNotificationInput): NewUserNotificationRow {
  return {
    userId: input.userId,
    roomId: input.roomId,
    type: input.type,
    title: input.title,
    message: input.message,
    payload: {
      roomId: input.payload.roomId,
      roomCode: input.payload.roomCode,
      roomName: input.payload.roomName,
      gameName: input.payload.gameName,
      ...(input.payload.gameCoverUrl === undefined
        ? {}
        : { gameCoverUrl: input.payload.gameCoverUrl }),
      players: input.payload.players.map((player) => ({
        name: player.name,
        image: player.image,
      })),
    },
  }
}

export function mapUserNotificationRow(row: UserNotificationRow): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    roomId: row.roomId,
    type: userNotificationTypeSchema.parse(row.type),
    title: row.title,
    message: row.message,
    payload: persistedUserNotificationPayloadSchema.parse(row.payload),
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}
