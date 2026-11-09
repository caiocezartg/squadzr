import { AppError } from './base.error'

/** An admin tried to close a Squad that is Ready or expired: only an Open Squad can be closed. */
export class RoomNotOpenError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_NOT_OPEN'

  constructor(roomId: string) {
    super(`Room "${roomId}" is not open`)
  }
}
