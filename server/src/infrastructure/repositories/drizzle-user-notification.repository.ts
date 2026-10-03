import { and, desc, eq, isNull } from 'drizzle-orm'
import { userNotificationPayloadSchema, userNotificationTypeSchema } from '@squadzr/schemas'
import type {
  CreateUserNotificationInput,
  UserNotification,
  UserNotificationPayload,
} from '@domain/entities/user-notification.entity'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import type { Database } from '@infrastructure/database/drizzle'
import {
  userNotifications,
  type UserNotificationRow,
} from '@infrastructure/database/schema/user-notifications'

function payloadToRecord(payload: UserNotificationPayload): Record<string, unknown> {
  return {
    roomId: payload.roomId,
    roomCode: payload.roomCode,
    roomName: payload.roomName,
    gameName: payload.gameName,
    players: payload.players,
    discordLink: payload.discordLink,
  }
}

function mapRowToEntity(row: UserNotificationRow): UserNotification {
  return {
    id: row.id,
    userId: row.userId,
    roomId: row.roomId,
    type: userNotificationTypeSchema.parse(row.type),
    title: row.title,
    message: row.message,
    payload: userNotificationPayloadSchema.parse(row.payload),
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

    return result.map(mapRowToEntity)
  }

  async create(input: CreateUserNotificationInput): Promise<UserNotification> {
    const result = await this.db
      .insert(userNotifications)
      .values({
        userId: input.userId,
        roomId: input.roomId,
        type: input.type,
        title: input.title,
        message: input.message,
        payload: payloadToRecord(input.payload),
      })
      .returning()

    const row = result[0]
    if (!row) {
      throw new Error('Failed to create user notification')
    }

    return mapRowToEntity(row)
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
