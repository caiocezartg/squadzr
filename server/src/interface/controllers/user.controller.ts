import type { FastifyReply, FastifyRequest } from 'fastify'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import type { IGetUserUseCase } from '@application/use-cases/user/get-user.use-case'
import type { IListNotificationsUseCase } from '@application/use-cases/notification/list-notifications.use-case'
import { UserNotFoundError, UnauthorizedError } from '@application/errors'
import { listNotificationsQuerySchema, notificationIdParamSchema } from '@application/dtos'
import { toUserDto, toUserNotificationDto } from '@application/projections'

function getUserId(request: FastifyRequest): string {
  if (!request.session?.user?.id) {
    throw new UnauthorizedError()
  }
  return request.session.user.id
}

export interface UserControllerDeps {
  readonly getUserUseCase: IGetUserUseCase
  readonly userNotificationRepository: IUserNotificationRepository
  readonly listNotificationsUseCase: IListNotificationsUseCase
}

export class UserController {
  constructor(private readonly deps: UserControllerDeps) {}

  async me(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = getUserId(request)
    const result = await this.deps.getUserUseCase.execute({ id: userId })

    if (!result.user) {
      throw new UserNotFoundError(userId)
    }

    await reply.send({ user: toUserDto(result.user) })
  }

  async listNotifications(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = getUserId(request)
    const query = listNotificationsQuerySchema.parse(request.query)
    const limit = query.limit ?? 20

    const result = await this.deps.listNotificationsUseCase.execute({ userId, limit })

    await reply.send({
      notifications: result.notifications.map(({ notification, discordLink }) =>
        toUserNotificationDto(notification, discordLink)
      ),
    })
  }

  async markNotificationAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = getUserId(request)
    const params = notificationIdParamSchema.parse(request.params)

    const success = await this.deps.userNotificationRepository.markAsRead(params.id, userId)

    await reply.send({ success })
  }

  async markAllNotificationsAsRead(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = getUserId(request)

    const count = await this.deps.userNotificationRepository.markAllAsRead(userId)

    await reply.send({ success: true, count })
  }

  async deleteNotification(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = getUserId(request)
    const params = notificationIdParamSchema.parse(request.params)

    const success = await this.deps.userNotificationRepository.delete(params.id, userId)

    await reply.send({ success })
  }
}
