import type { UserNotification } from '@domain/entities/user-notification.entity'

export interface IUserNotificationRepository {
  findByUserId(userId: string, limit?: number): Promise<UserNotification[]>
  markAsRead(id: string, userId: string): Promise<boolean>
  markAllAsRead(userId: string): Promise<number>
  delete(id: string, userId: string): Promise<boolean>
}
