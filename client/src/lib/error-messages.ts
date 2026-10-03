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

function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODE_KEYS as readonly string[]).includes(code)
}

export function getUserFriendlyError(error: unknown): string {
  if (error instanceof ApiClientError && error.code && isKnownErrorCode(error.code)) {
    return i18n.t(`errors.${error.code}`)
  }
  return i18n.t('errors.DEFAULT')
}
