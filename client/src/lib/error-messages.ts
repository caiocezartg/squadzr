import { ApiClientError } from './api'
import i18n from './i18n'

const ERROR_CODE_KEYS = [
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_READY',
  'ALREADY_IN_ROOM',
  'NOT_ROOM_MEMBER',
  'ROOM_CREATE_LIMIT_REACHED',
  'ROOM_JOIN_LIMIT_REACHED',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'INTERNAL_ERROR',
] as const

type ErrorCode = (typeof ERROR_CODE_KEYS)[number]

/**
 * The Membership action that produced the error. Only the caller knows what it
 * attempted: the server answers `ROOM_READY` both to a player trying to join
 * and to a member trying to leave.
 */
export type MembershipAction = 'join' | 'leave'

/** A translation key under `errors.`: the code itself or its action override. */
type ErrorTranslationKey = ErrorCode | 'ROOM_READY_JOIN'

/**
 * Translation keys for error codes whose message depends on the Membership
 * action. A code absent from the table reads the same in every action.
 */
const ACTION_ERROR_KEYS: Partial<
  Record<ErrorCode, Partial<Record<MembershipAction, ErrorTranslationKey>>>
> = {
  ROOM_READY: {
    join: 'ROOM_READY_JOIN',
    leave: 'ROOM_READY',
  },
}

function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODE_KEYS as readonly string[]).includes(code)
}

function errorTranslationKey(code: ErrorCode, action?: MembershipAction): ErrorTranslationKey {
  if (!action) return code
  return ACTION_ERROR_KEYS[code]?.[action] ?? code
}

/**
 * Maps a typed application error to its friendly, localized message. The
 * action selects the message of the codes whose meaning depends on it.
 */
export function getUserFriendlyError(error: unknown, action?: MembershipAction): string {
  if (error instanceof ApiClientError && error.code && isKnownErrorCode(error.code)) {
    return i18n.t(`errors.${errorTranslationKey(error.code, action)}`)
  }
  return i18n.t('errors.DEFAULT')
}
