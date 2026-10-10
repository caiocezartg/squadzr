import type { FastifyReply, FastifyRequest } from 'fastify'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { gameIdParamSchema } from '@squadzr/schemas'
import { toGameDto } from '@application/projections'
import type { z } from 'zod'

export interface GameControllerDeps {
  readonly gameRepository: IGameRepository
}

export class GameController {
  constructor(private readonly deps: GameControllerDeps) {}

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const games = await this.deps.gameRepository.findAll()

    await reply.send({ games: games.map(toGameDto) })
  }

  async getById(
    request: FastifyRequest<{ Params: z.infer<typeof gameIdParamSchema> }>,
    reply: FastifyReply
  ): Promise<void> {
    const game = await this.deps.gameRepository.findById(request.params.id)

    if (!game) {
      await reply.status(404).send({ error: 'Not Found', message: 'Game not found' })
      return
    }

    await reply.send({ game: toGameDto(game) })
  }
}
