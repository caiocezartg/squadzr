import type { FastifyReply, FastifyRequest } from 'fastify'
import type { gameIdParamSchema, gamesQuerySchema, popularGamesQuerySchema } from '@squadzr/schemas'
import type { IListGamesUseCase } from '@application/use-cases/game/list-games.use-case'
import type { IGetGameUseCase } from '@application/use-cases/game/get-game.use-case'
import type { IGetPopularGamesUseCase } from '@application/use-cases/game/get-popular-games.use-case'
import { toGameDto } from '@application/projections'
import type { z } from 'zod'

export interface GameControllerDeps {
  readonly listGamesUseCase: IListGamesUseCase
  readonly getGameUseCase: IGetGameUseCase
  readonly getPopularGamesUseCase: IGetPopularGamesUseCase
}

export class GameController {
  constructor(private readonly deps: GameControllerDeps) {}

  async list(
    request: FastifyRequest<{ Querystring: z.infer<typeof gamesQuerySchema> }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.listGamesUseCase.execute({
      search: request.query.search,
      limit: request.query.limit,
    })

    await reply.send({ games: result.games.map(toGameDto) })
  }

  async getById(
    request: FastifyRequest<{ Params: z.infer<typeof gameIdParamSchema> }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.getGameUseCase.execute({ id: request.params.id })

    await reply.send({ game: toGameDto(result.game) })
  }

  async popular(
    request: FastifyRequest<{ Querystring: z.infer<typeof popularGamesQuerySchema> }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.getPopularGamesUseCase.execute({
      limit: request.query.limit,
    })

    await reply.send({
      totalGames: result.totalGames,
      games: result.games.map(({ game, openSquadCount, topTags }) => ({
        game: toGameDto(game),
        openSquadCount,
        topTags,
      })),
    })
  }
}
