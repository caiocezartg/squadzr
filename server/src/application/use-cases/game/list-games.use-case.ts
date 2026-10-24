import type { Game } from '@domain/entities/game.entity'
import type { IGameRepository, SearchGamesInput } from '@domain/repositories/game.repository'

export interface ListGamesOutput {
  readonly games: Game[]
}

export interface IListGamesUseCase {
  execute(input: SearchGamesInput): Promise<ListGamesOutput>
}

export class ListGamesUseCase implements IListGamesUseCase {
  constructor(private readonly gameRepository: IGameRepository) {}

  async execute(input: SearchGamesInput): Promise<ListGamesOutput> {
    const games = await this.gameRepository.search(input)
    return { games }
  }
}
