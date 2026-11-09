import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { adminGameIdParamSchema, adminGamesQuerySchema } from '@squadzr/schemas'
import type { IGetAdminGameUseCase } from '@application/use-cases/admin/get-admin-game.use-case'
import type { IGetAdminGamesSummaryUseCase } from '@application/use-cases/admin/get-admin-games-summary.use-case'
import type { IListAdminGamesUseCase } from '@application/use-cases/admin/list-admin-games.use-case'
import {
  toAdminGameDetailDto,
  toAdminGameDto,
  toAdminGamesSummaryDto,
  toAdminSquadDto,
} from '@application/projections'

type GamesQuery = z.infer<typeof adminGamesQuerySchema>
type GameParams = z.infer<typeof adminGameIdParamSchema>

export interface AdminCatalogGamesControllerDeps {
  readonly listAdminGamesUseCase: IListAdminGamesUseCase
  readonly getAdminGameUseCase: IGetAdminGameUseCase
  readonly getAdminGamesSummaryUseCase: IGetAdminGamesSummaryUseCase
}

export class AdminCatalogGamesController {
  constructor(private readonly deps: AdminCatalogGamesControllerDeps) {}

  async list(
    request: FastifyRequest<{ Querystring: GamesQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const { page, q, status, sort } = request.query
    const result = await this.deps.listAdminGamesUseCase.execute({ page, q, status, sort })

    await reply.send({
      items: result.games.map(toAdminGameDto),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  }

  async summary(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const summary = await this.deps.getAdminGamesSummaryUseCase.execute()

    await reply.send(toAdminGamesSummaryDto(summary))
  }

  async get(request: FastifyRequest<{ Params: GameParams }>, reply: FastifyReply): Promise<void> {
    const result = await this.deps.getAdminGameUseCase.execute({ gameId: request.params.id })

    await reply.send({
      game: toAdminGameDetailDto(result.game),
      openSquads: result.openSquads.map(toAdminSquadDto),
    })
  }
}
