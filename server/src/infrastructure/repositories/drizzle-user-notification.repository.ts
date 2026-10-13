import { and, desc, eq, isNull } from 'drizzle-orm'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { userNotifications } from '@infrastructure/database/schema/user-notifications'
import { ROOM } from '@config/constants'
import { mapUserNotificationRow } from './user-notification-mapping'

export class DrizzleUserNotificationRepository implements IUserNotificationRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  async findByUserId(userId: string, limit = ROOM.NOTIFICATION_LIMIT): Promise<UserNotification[]> {
    const result = await this.db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit)

    return result.map(mapUserNotificationRow)
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(userNotifications)
      .set({
        readAt: this.clock.now(),
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
        readAt: this.clock.now(),
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
