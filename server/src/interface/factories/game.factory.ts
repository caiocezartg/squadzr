import type { Database } from '@infrastructure/database/drizzle'
import type { IGameRepository } from '@domain/repositories/game.repository'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { ListGamesUseCase } from '@application/use-cases/game/list-games.use-case'
import { GetGameUseCase } from '@application/use-cases/game/get-game.use-case'
import { GameController } from '@interface/controllers/game.controller'

export function createGameRepository(db: Database): IGameRepository {
  return new DrizzleGameRepository(db)
}

export function createGameController(db: Database) {
  const gameRepository = createGameRepository(db)

  const listGamesUseCase = new ListGamesUseCase(gameRepository)
  const getGameUseCase = new GetGameUseCase(gameRepository)

  return new GameController({ listGamesUseCase, getGameUseCase })
}
