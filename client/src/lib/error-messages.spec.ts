/**
 * The error-code to message seam: `ROOM_READY` reaches a player who tried to
 * join and a member who tried to leave, and the caller passes the action so
 * each one reads the message for what it attempted. The caller also passes the
 * translator, so each test picks the language it asserts.
 */

import { describe, expect, it } from 'vitest'
import { createTranslator } from 'next-intl'
import en from '@/locales/en.json'
import ptBR from '@/locales/pt-BR.json'
import { ApiClientError } from './api'
import { getUserFriendlyError, translateErrorCode } from './error-messages'

const t = createTranslator({ locale: 'en', messages: en })
const tPtBR = createTranslator({ locale: 'pt-BR', messages: ptBR })

function apiError(code: string): ApiClientError {
  return new ApiClientError('server message', 422, code)
}

describe('getUserFriendlyError', () => {
  it('maps a refused join of a Ready squad to the no-longer-accepting message', () => {
    expect(getUserFriendlyError(apiError('ROOM_READY'), t, 'join')).toBe(
      "This squad is already full and ready — it's no longer accepting players."
    )
  })

  it('keeps the members-cannot-leave message for a refused leave', () => {
    expect(getUserFriendlyError(apiError('ROOM_READY'), t, 'leave')).toBe(
      'This squad is ready — members cannot leave.'
    )
  })

  it('reads the same for action-independent codes in both contexts', () => {
    expect(getUserFriendlyError(apiError('ROOM_FULL'), t, 'join')).toBe(
      'This squad is already full.'
    )
    expect(getUserFriendlyError(apiError('ROOM_FULL'), t, 'leave')).toBe(
      'This squad is already full.'
    )
  })
})

describe('GAME_NOT_FOUND', () => {
  it('translates a missing game in English', () => {
    expect(getUserFriendlyError(apiError('GAME_NOT_FOUND'), t)).toBe(
      'This game could not be found.'
    )
  })

  it('translates a missing game in Portuguese', () => {
    expect(getUserFriendlyError(apiError('GAME_NOT_FOUND'), tPtBR)).toBe(
      'Este jogo não foi encontrado.'
    )
  })
})

describe('INVALID_GAME', () => {
  it('asks for another game in English', () => {
    expect(getUserFriendlyError(apiError('INVALID_GAME'), t)).toBe(
      'This game is no longer available. Please choose another game.'
    )
  })

  it('asks for another game in Portuguese', () => {
    expect(getUserFriendlyError(apiError('INVALID_GAME'), tPtBR)).toBe(
      'Este jogo não está mais disponível. Por favor, escolha outro jogo.'
    )
  })
})

describe('translateErrorCode', () => {
  it('translates a known code, such as a realtime error payload', () => {
    expect(translateErrorCode('ROOM_FULL', tPtBR)).toBe('Este squad já está cheio.')
  })

  it('reads an unknown code as the generic message', () => {
    expect(translateErrorCode('SOMETHING_NEW', t)).toBe('Something went wrong. Please try again.')
  })
})
