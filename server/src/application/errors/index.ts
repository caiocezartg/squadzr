export { AppError } from './base.error'
export {
  GameNotAvailableError,
  InvalidGameError,
  PlatformNotAvailableError,
} from './validation.error'
export { UnauthorizedError } from './unauthorized.error'
export { ForbiddenOriginError } from './forbidden-origin.error'
export { RateLimitedError } from './rate-limited.error'
export { GameNotFoundError, RoomNotFoundError, UserNotFoundError } from './not-found.error'
export {
  InvalidDiscordInviteError,
  RoomFullError,
  RoomReadyError,
  NotRoomMemberError,
  RoomNotReadyError,
  RoomCreateLimitReachedError,
  RoomJoinLimitReachedError,
} from './business-rule.error'
