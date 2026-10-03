import { AppError } from './base.error'

export class RoomFullError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_FULL'

  constructor(roomId: string) {
    super(`Room "${roomId}" is full`)
  }
}

export class RoomReadyError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_READY'

  constructor(roomId: string) {
    super(`Room "${roomId}" is ready — players cannot leave`)
  }
}

export class NotRoomMemberError extends AppError {
  readonly statusCode = 422
  readonly code = 'NOT_ROOM_MEMBER'

  constructor(userId: string, roomId: string) {
    super(`User "${userId}" is not a member of room "${roomId}"`)
  }
}

export class RoomCreateLimitReachedError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_CREATE_LIMIT_REACHED'

  constructor(limit: number) {
    super(`You can only host ${limit} active rooms at a time`)
  }
}

export class RoomJoinLimitReachedError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_JOIN_LIMIT_REACHED'

  constructor(limit: number) {
    super(`You can only be in ${limit} active rooms at a time`)
  }
}
