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

  constructor(roomId: string, action: 'join' | 'leave' | 'chat' = 'leave') {
    super(
      {
        join: `Room "${roomId}" is ready — it no longer accepts members`,
        leave: `Room "${roomId}" is ready — players cannot leave`,
        chat: `Room "${roomId}" is ready — its chat is read-only`,
      }[action]
    )
  }
}

export class NotRoomMemberError extends AppError {
  readonly statusCode = 422
  readonly code = 'NOT_ROOM_MEMBER'

  constructor(userId: string, roomId: string) {
    super(`User "${userId}" is not a member of room "${roomId}"`)
  }
}

export class InvalidDiscordInviteError extends AppError {
  readonly statusCode = 422
  readonly code = 'INVALID_DISCORD_INVITE'

  constructor() {
    super('The Discord invite does not exist or has expired')
  }
}

export class RoomCreateLimitReachedError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_CREATE_LIMIT_REACHED'

  constructor(limit: number) {
    super(`You can only host ${limit} open ${limit === 1 ? 'squad' : 'squads'} at a time`)
  }
}

export class RoomJoinLimitReachedError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_JOIN_LIMIT_REACHED'

  constructor(limit: number) {
    super(`You can only be in ${limit} open ${limit === 1 ? 'squad' : 'squads'} at a time`)
  }
}

export class RoomNotReadyError extends AppError {
  readonly statusCode = 422
  readonly code = 'ROOM_NOT_READY'

  constructor(roomId: string) {
    super(`Room "${roomId}" is not ready yet`)
  }
}
