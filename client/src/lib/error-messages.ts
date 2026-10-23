import { ApiClientError } from './api'

const ERROR_CODE_KEYS = [
  'GAME_NOT_FOUND',
  'INVALID_GAME',
  'ROOM_NOT_FOUND',
  'ROOM_FULL',
  'ROOM_READY',
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

/** A translation key under `errors.`: the code itself, its action override or the generic message. */
type ErrorTranslationKey = ErrorCode | 'SQUAD_READY_JOIN' | 'DEFAULT'

/**
 * The translator a caller passes in (`useTranslations()` in a component). Code outside React gets
 * its messages as an argument, so the mapping never reads a locale of its own.
 */
export type ErrorTranslator = (key: `errors.${ErrorTranslationKey}`) => string

/**
 * Translation keys for error codes whose message depends on the Membership
 * action. A code absent from the table reads the same in every action.
 */
const ACTION_ERROR_KEYS: Partial<
  Record<ErrorCode, Partial<Record<MembershipAction, ErrorTranslationKey>>>
> = {
  ROOM_READY: {
    join: 'SQUAD_READY_JOIN',
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
 * The message of an error code, translated. The action selects the message of the codes whose
 * meaning depends on it. A code the app does not know reads as the generic message.
 */
export function translateErrorCode(
  code: string,
  t: ErrorTranslator,
  action?: MembershipAction
): string {
  if (!isKnownErrorCode(code)) return t('errors.DEFAULT')
  return t(`errors.${errorTranslationKey(code, action)}`)
}

/**
 * Maps a typed application error to its friendly, localized message. The
 * action selects the message of the codes whose meaning depends on it.
 */
export function getUserFriendlyError(
  error: unknown,
  t: ErrorTranslator,
  action?: MembershipAction
): string {
  if (error instanceof ApiClientError && error.code) {
    return translateErrorCode(error.code, t, action)
  }
  return t('errors.DEFAULT')
}
