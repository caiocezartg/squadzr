import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type {
  adminUserParamsSchema,
  adminUsersQuerySchema,
  changeUserRoleInputSchema,
} from '@squadzr/schemas'
import type { IChangeUserRoleUseCase } from '@application/use-cases/admin/change-user-role.use-case'
import type { IGetAdminUserUseCase } from '@application/use-cases/admin/get-admin-user.use-case'
import type { IListAdminUsersUseCase } from '@application/use-cases/admin/list-admin-users.use-case'
import {
  toAdminUserDetailDto,
  toAdminUserDto,
  toAdminUserListItemDto,
} from '@application/projections'

type UsersQuery = z.infer<typeof adminUsersQuerySchema>
type UserParams = z.infer<typeof adminUserParamsSchema>
type ChangeRoleBody = z.infer<typeof changeUserRoleInputSchema>

export interface AdminUsersControllerDeps {
  readonly listAdminUsersUseCase: IListAdminUsersUseCase
  readonly getAdminUserUseCase: IGetAdminUserUseCase
  readonly changeUserRoleUseCase: IChangeUserRoleUseCase
}

export class AdminUsersController {
  constructor(private readonly deps: AdminUsersControllerDeps) {}

  async list(
    request: FastifyRequest<{ Querystring: UsersQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.listAdminUsersUseCase.execute({
      search: request.query.q,
      page: request.query.page,
    })

    await reply.send({
      items: result.users.map(toAdminUserListItemDto),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  }

  async get(request: FastifyRequest<{ Params: UserParams }>, reply: FastifyReply): Promise<void> {
    const detail = await this.deps.getAdminUserUseCase.execute({ id: request.params.id })

    await reply.send({ user: toAdminUserDetailDto(detail) })
  }

  async changeRole(
    request: FastifyRequest<{ Params: UserParams; Body: ChangeRoleBody }>,
    reply: FastifyReply
  ): Promise<void> {
    const { user } = await this.deps.changeUserRoleUseCase.execute({
      actorId: request.userId,
      targetId: request.params.id,
      role: request.body.role,
    })

    await reply.send({ user: toAdminUserDto(user) })
  }
}
