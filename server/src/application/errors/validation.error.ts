import { AppError } from './base.error'

export class InvalidGameError extends AppError {
  readonly statusCode = 400
  readonly code = 'INVALID_GAME'

  constructor(gameId: string) {
    super(`Game with id "${gameId}" does not exist`)
  }
}

/** The chosen platform does not fit the Game: not one of its platforms, missing, or sent for a Game without any. */
export class PlatformNotAvailableError extends AppError {
  readonly statusCode = 400
  readonly code = 'INVALID_PLATFORM'

  constructor(gameId: string, platform: string | null) {
    super(
      platform === null
        ? `Game with id "${gameId}" needs a platform`
        : `Platform "${platform}" is not available for game with id "${gameId}"`
    )
  }
}

/** A Game that left the catalog: the id exists, so the message says why it cannot be used. */
export class GameNotAvailableError extends AppError {
  readonly statusCode = 400
  readonly code = 'INVALID_GAME'

  constructor(gameId: string) {
    super(`Game with id "${gameId}" is no longer available`)
  }
}
