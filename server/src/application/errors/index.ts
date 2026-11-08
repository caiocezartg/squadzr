export { AppError } from './base.error'
export {
  GameNotAvailableError,
  InvalidGameError,
  PlatformNotAvailableError,
} from './validation.error'
export { UnauthorizedError } from './unauthorized.error'
export { ForbiddenOriginError } from './forbidden-origin.error'
export { AdminRequiredError } from './admin-required.error'
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
export {
  CannotChangeOwnRoleError,
  CannotChangeOwnerError,
  OwnerAlreadyExistsError,
  RoleChangeForbiddenError,
} from './role-change.error'
export { RoomNotOpenError } from './room-not-open.error'
