import {
  hostTransferredNotificationPayloadSchema,
  memberLeftNotificationPayloadSchema,
  roomClosedByAdminNotificationPayloadSchema,
  roomClosedNotificationPayloadSchema,
  roomReadyNotificationPayloadSchema,
  userNotificationTypeSchema,
} from '@squadzr/schemas'
import type {
  CreateUserNotificationInput,
  UserNotification,
} from '@domain/entities/user-notification.entity'
import type {
  NewUserNotificationRow,
  UserNotificationRow,
} from '@infrastructure/database/schema/user-notifications'

// Persisted payloads: the contract payloads minus the Discord invite. Unknown keys are
// stripped, so legacy rows that still stored the link do not leak it.
const persistedRoomReadyPayloadSchema = roomReadyNotificationPayloadSchema.omit({
  discordLink: true,
})

export function notificationInputToRow(input: CreateUserNotificationInput): NewUserNotificationRow {
  return {
    userId: input.userId,
    roomId: input.roomId,
    type: input.type,
    title: input.title,
    message: input.message,
    payload: { ...input.payload },
  }
}

export function mapUserNotificationRow(row: UserNotificationRow): UserNotification {
  const base = {
    id: row.id,
    userId: row.userId,
    roomId: row.roomId,
    title: row.title,
    message: row.message,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
  const type = userNotificationTypeSchema.parse(row.type)
  switch (type) {
    case 'room_ready':
      return { ...base, type, payload: persistedRoomReadyPayloadSchema.parse(row.payload) }
    case 'host_transferred':
      return { ...base, type, payload: hostTransferredNotificationPayloadSchema.parse(row.payload) }
    case 'member_left':
      return { ...base, type, payload: memberLeftNotificationPayloadSchema.parse(row.payload) }
    case 'room_closed':
      return { ...base, type, payload: roomClosedNotificationPayloadSchema.parse(row.payload) }
    case 'room_closed_by_admin':
      return {
        ...base,
        type,
        payload: roomClosedByAdminNotificationPayloadSchema.parse(row.payload),
      }
  }
}
