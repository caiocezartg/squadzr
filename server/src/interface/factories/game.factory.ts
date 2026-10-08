import type { Database } from '@infrastructure/database/drizzle'
import type { IGameRepository } from '@domain/repositories/game.repository'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { GameController } from '@interface/controllers/game.controller'

export function createGameRepository(db: Database): IGameRepository {
  return new DrizzleGameRepository(db)
}

export function createGameController(db: Database) {
  const gameRepository = createGameRepository(db)

  return new GameController({ gameRepository })
}
