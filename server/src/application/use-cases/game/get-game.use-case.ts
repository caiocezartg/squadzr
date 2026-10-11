import type { Game } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'
import { GameNotFoundError } from '@application/errors'

export interface GetGameInput {
  readonly id: string
}

export interface GetGameOutput {
  readonly game: Game
}

export interface IGetGameUseCase {
  execute(input: GetGameInput): Promise<GetGameOutput>
}

export class GetGameUseCase implements IGetGameUseCase {
  constructor(private readonly gameRepository: IGameRepository) {}

  async execute(input: GetGameInput): Promise<GetGameOutput> {
    const game = await this.gameRepository.findById(input.id)
    if (!game) {
      throw new GameNotFoundError(input.id)
    }
    return { game }
  }
}
