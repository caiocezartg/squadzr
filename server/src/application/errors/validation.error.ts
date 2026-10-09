import { AppError } from './base.error'

export class InvalidGameError extends AppError {
  readonly statusCode = 400
  readonly code = 'INVALID_GAME'

  constructor(gameId: string) {
    super(`Game with id "${gameId}" does not exist`)
  }
}
