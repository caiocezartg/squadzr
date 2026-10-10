import type { Game } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'

export interface ListGamesOutput {
  readonly games: Game[]
}

export interface IListGamesUseCase {
  execute(): Promise<ListGamesOutput>
}

export class ListGamesUseCase implements IListGamesUseCase {
  constructor(private readonly gameRepository: IGameRepository) {}

  async execute(): Promise<ListGamesOutput> {
    const games = await this.gameRepository.findAll()
    return { games }
  }
}
