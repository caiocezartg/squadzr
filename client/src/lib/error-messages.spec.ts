/**
 * The error-code to message seam: `ROOM_READY` reaches a player who tried to
 * join and a member who tried to leave, and the caller passes the action so
 * each one reads the message for what it attempted.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { ApiClientError } from './api'
import { getUserFriendlyError } from './error-messages'
import i18n from './i18n'

function apiError(code: string): ApiClientError {
  return new ApiClientError('server message', 422, code)
}

describe('getUserFriendlyError', () => {
  it('maps a refused join of a Ready room to the no-longer-accepting message', () => {
    expect(getUserFriendlyError(apiError('ROOM_READY'), 'join')).toBe(
      "This squad is already full and ready — it's no longer accepting players."
    )
  })

  it('keeps the members-cannot-leave message for a refused leave', () => {
    expect(getUserFriendlyError(apiError('ROOM_READY'), 'leave')).toBe(
      'This squad is ready — members cannot leave.'
    )
  })

  it('reads the same for action-independent codes in both contexts', () => {
    expect(getUserFriendlyError(apiError('ROOM_FULL'), 'join')).toBe('This squad is already full.')
    expect(getUserFriendlyError(apiError('ROOM_FULL'), 'leave')).toBe('This squad is already full.')
  })
})

describe('GAME_NOT_FOUND', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('translates a missing game in English', () => {
    expect(getUserFriendlyError(apiError('GAME_NOT_FOUND'))).toBe('This game could not be found.')
  })

  it('translates a missing game in Portuguese', async () => {
    await i18n.changeLanguage('pt-BR')

    expect(getUserFriendlyError(apiError('GAME_NOT_FOUND'))).toBe('Este jogo não foi encontrado.')
  })
})
