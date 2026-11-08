import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { activityQuerySchema, overviewQuerySchema } from '@squadzr/schemas'
import type { IGetAdminActivityUseCase } from '@application/use-cases/admin/get-admin-activity.use-case'
import type { IGetAdminOverviewUseCase } from '@application/use-cases/admin/get-admin-overview.use-case'
import { toActivityResponse, toOverviewResponse } from '@application/projections'

type OverviewQuery = z.infer<typeof overviewQuerySchema>
type ActivityQuery = z.infer<typeof activityQuerySchema>

export interface AdminOverviewControllerDeps {
  readonly getAdminOverviewUseCase: IGetAdminOverviewUseCase
  readonly getAdminActivityUseCase: IGetAdminActivityUseCase
}

export class AdminOverviewController {
  constructor(private readonly deps: AdminOverviewControllerDeps) {}

  async overview(
    request: FastifyRequest<{ Querystring: OverviewQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.getAdminOverviewUseCase.execute({
      period: request.query.period,
      viewerRole: request.session?.user.role,
    })

    await reply.send(toOverviewResponse(result))
  }

  async activity(
    request: FastifyRequest<{ Querystring: ActivityQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.getAdminActivityUseCase.execute({
      metric: request.query.metric,
      period: request.query.period,
    })

    await reply.send(toActivityResponse(result))
  }
}
