import { z } from 'zod'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { userNotificationTypeSchema } from '@squadzr/schemas'
import type {
  CreateUserNotificationInput,
  UserNotification,
  UserNotificationPayload,
} from '@domain/entities/user-notification.entity'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import type { Database } from '@infrastructure/database/drizzle'
import {
  userNotifications,
  type NewUserNotificationRow,
  type UserNotificationRow,
} from '@infrastructure/database/schema/user-notifications'

// Persisted payload: never carries the Discord invite. Unknown keys are
// stripped so legacy rows that still stored the link do not leak it.
const persistedUserNotificationPayloadSchema = z.object({
  roomId: z.uuid(),
  roomCode: z.string().length(6),
  roomName: z.string(),
  gameName: z.string(),
  players: z.array(z.object({ name: z.string(), image: z.string().nullable() })),
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
    payload: persistedUserNotificationPayloadSchema.parse(row.payload) as UserNotificationPayload,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

export class DrizzleUserNotificationRepository implements IUserNotificationRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: string, limit = 20): Promise<UserNotification[]> {
    const result = await this.db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit)

    return result.map(mapUserNotificationRow)
  }

  async create(input: CreateUserNotificationInput): Promise<UserNotification> {
    const result = await this.db
      .insert(userNotifications)
      .values(notificationInputToRow(input))
      .returning()

    const row = result[0]
    if (!row) {
      throw new Error('Failed to create user notification')
    }

    return mapUserNotificationRow(row)
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(userNotifications)
      .set({
        readAt: new Date(),
      })
      .where(
        and(
          eq(userNotifications.id, id),
          eq(userNotifications.userId, userId),
          isNull(userNotifications.readAt)
        )
      )
      .returning({ id: userNotifications.id })

    return result.length > 0
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.db
      .update(userNotifications)
      .set({
        readAt: new Date(),
      })
      .where(and(eq(userNotifications.userId, userId), isNull(userNotifications.readAt)))
      .returning({ id: userNotifications.id })

    return result.length
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(userNotifications)
      .where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)))
      .returning({ id: userNotifications.id })

    return result.length > 0
  }
}
