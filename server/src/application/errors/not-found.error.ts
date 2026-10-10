import { AppError } from './base.error'

export class RoomNotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'ROOM_NOT_FOUND'

  constructor(identifier: string) {
    super(`Room "${identifier}" not found`)
  }
}

export class UserNotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'USER_NOT_FOUND'

  constructor(userId: string) {
    super(`User "${userId}" not found`)
  }
}
