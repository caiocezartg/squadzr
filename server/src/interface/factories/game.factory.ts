import type { Database } from '@infrastructure/database/drizzle'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { ListGamesUseCase } from '@application/use-cases/game/list-games.use-case'
import { GetGameUseCase } from '@application/use-cases/game/get-game.use-case'
import { GetPopularGamesUseCase } from '@application/use-cases/game/get-popular-games.use-case'
import { GameController } from '@interface/controllers/game.controller'

export function createGameRepository(db: Database, clock: Clock): IGameRepository {
  return new DrizzleGameRepository(db, clock)
}

export function createGameController(db: Database, clock: Clock) {
  const gameRepository = createGameRepository(db, clock)

  const listGamesUseCase = new ListGamesUseCase(gameRepository)
  const getGameUseCase = new GetGameUseCase(gameRepository)
  const getPopularGamesUseCase = new GetPopularGamesUseCase(gameRepository, clock)

  return new GameController({ listGamesUseCase, getGameUseCase, getPopularGamesUseCase })
}
