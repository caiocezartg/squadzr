import type { PopularGame } from '@domain/entities/game.entity'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'

export interface GetPopularGamesInput {
  /** The maximum number of games to return. */
  readonly limit: number
}

export interface GetPopularGamesOutput {
  /** Every Listed Game, not just the returned page. */
  readonly totalGames: number
  readonly games: PopularGame[]
}

export interface IGetPopularGamesUseCase {
  execute(input: GetPopularGamesInput): Promise<GetPopularGamesOutput>
}

export class GetPopularGamesUseCase implements IGetPopularGamesUseCase {
  constructor(
    private readonly gameRepository: IGameRepository,
    private readonly clock: Clock
  ) {}

  async execute({ limit }: GetPopularGamesInput): Promise<GetPopularGamesOutput> {
    // The Open Room window is measured at one instant for the whole page.
    return this.gameRepository.findPopular({ limit, now: this.clock.now() })
  }
}
