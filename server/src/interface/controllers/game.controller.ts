import type { FastifyReply, FastifyRequest } from 'fastify'
import type { gameIdParamSchema } from '@squadzr/schemas'
import type { IListGamesUseCase } from '@application/use-cases/game/list-games.use-case'
import type { IGetGameUseCase } from '@application/use-cases/game/get-game.use-case'
import { toGameDto } from '@application/projections'
import type { z } from 'zod'

export interface GameControllerDeps {
  readonly listGamesUseCase: IListGamesUseCase
  readonly getGameUseCase: IGetGameUseCase
}

export class GameController {
  constructor(private readonly deps: GameControllerDeps) {}

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const result = await this.deps.listGamesUseCase.execute()

    await reply.send({ games: result.games.map(toGameDto) })
  }

  async getById(
    request: FastifyRequest<{ Params: z.infer<typeof gameIdParamSchema> }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.getGameUseCase.execute({ id: request.params.id })

    await reply.send({ game: toGameDto(result.game) })
  }
}
