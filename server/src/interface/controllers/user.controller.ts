import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  playerProfileParamsSchema,
} from '@squadzr/schemas'
import type { IGetUserUseCase } from '@application/use-cases/user/get-user.use-case'
import type { IGetPlayerProfileUseCase } from '@application/use-cases/user/get-player-profile.use-case'
import type { IListNotificationsUseCase } from '@application/use-cases/notification/list-notifications.use-case'
import type { IMarkNotificationReadUseCase } from '@application/use-cases/notification/mark-notification-read.use-case'
import type { IMarkAllNotificationsReadUseCase } from '@application/use-cases/notification/mark-all-notifications-read.use-case'
import type { IDeleteNotificationUseCase } from '@application/use-cases/notification/delete-notification.use-case'
import { toPlayerProfileDto, toUserDto, toUserNotificationDto } from '@application/projections'

type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>
type NotificationIdParams = z.infer<typeof notificationIdParamSchema>
type PlayerProfileParams = z.infer<typeof playerProfileParamsSchema>

export interface UserControllerDeps {
  readonly getUserUseCase: IGetUserUseCase
  readonly getPlayerProfileUseCase: IGetPlayerProfileUseCase
  readonly listNotificationsUseCase: IListNotificationsUseCase
  readonly markNotificationReadUseCase: IMarkNotificationReadUseCase
  readonly markAllNotificationsReadUseCase: IMarkAllNotificationsReadUseCase
  readonly deleteNotificationUseCase: IDeleteNotificationUseCase
}

export class UserController {
  constructor(private readonly deps: UserControllerDeps) {}

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await this.deps.getUserUseCase.execute({ id: request.userId })

    await reply.send({ user: toUserDto(result.user) })
  }

  async playerProfile(
    request: FastifyRequest<{ Params: PlayerProfileParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const { user, stats } = await this.deps.getPlayerProfileUseCase.execute({
      id: request.params.id,
    })

    await reply.send({ profile: toPlayerProfileDto(user, stats) })
  }

  async listNotifications(
    request: FastifyRequest<{ Querystring: ListNotificationsQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.listNotificationsUseCase.execute({
      userId: request.userId,
      limit: request.query.limit,
    })

    await reply.send({
      notifications: result.notifications.map(({ notification, discordLink }) =>
        toUserNotificationDto(notification, discordLink)
      ),
    })
  }

  async markNotificationAsRead(
    request: FastifyRequest<{ Params: NotificationIdParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.markNotificationReadUseCase.execute({
      id: request.params.id,
      userId: request.userId,
    })

    await reply.send({ success: result.success })
  }

  async markAllNotificationsAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await this.deps.markAllNotificationsReadUseCase.execute({
      userId: request.userId,
    })

    await reply.send({ success: true, count: result.count })
  }

  async deleteNotification(
    request: FastifyRequest<{ Params: NotificationIdParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.deleteNotificationUseCase.execute({
      id: request.params.id,
      userId: request.userId,
    })

    await reply.send({ success: result.success })
  }
}
