import { AppError } from './base.error'

export class InvalidGameError extends AppError {
  readonly statusCode = 400
  readonly code = 'INVALID_GAME'

  constructor(gameId: string) {
    super(`Game with id "${gameId}" does not exist`)
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
