import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { DrizzleUserNotificationRepository } from '@infrastructure/repositories/drizzle-user-notification.repository'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { GetUserUseCase } from '@application/use-cases/user/get-user.use-case'
import { ListNotificationsUseCase } from '@application/use-cases/notification/list-notifications.use-case'
import { MarkNotificationReadUseCase } from '@application/use-cases/notification/mark-notification-read.use-case'
import { MarkAllNotificationsReadUseCase } from '@application/use-cases/notification/mark-all-notifications-read.use-case'
import { DeleteNotificationUseCase } from '@application/use-cases/notification/delete-notification.use-case'
import { UserController } from '@interface/controllers/user.controller'

export function createUserController(db: Database, clock: Clock) {
  const userRepository = new DrizzleUserRepository(db)
  const userNotificationRepository = new DrizzleUserNotificationRepository(db)
  const roomRepository = new DrizzleRoomRepository(db, clock)

  const getUserUseCase = new GetUserUseCase(userRepository)
  const listNotificationsUseCase = new ListNotificationsUseCase(
    userNotificationRepository,
    roomRepository,
    clock
  )
  const markNotificationReadUseCase = new MarkNotificationReadUseCase(userNotificationRepository)
  const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase(
    userNotificationRepository
  )
  const deleteNotificationUseCase = new DeleteNotificationUseCase(userNotificationRepository)

  return new UserController({
    getUserUseCase,
    listNotificationsUseCase,
    markNotificationReadUseCase,
    markAllNotificationsReadUseCase,
    deleteNotificationUseCase,
  })
}
