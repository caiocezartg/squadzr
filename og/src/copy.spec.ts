import { describe, expect, it } from 'vitest'
import { imageCopy } from './copy'

describe('imageCopy', () => {
  it.each([
    ['pt-br', 3, 5, 'Squad aberto', 'Faltam 2 — entra aí'],
    ['pt-br', 4, 5, 'Squad aberto', 'Falta 1 — entra aí'],
    ['pt-br', 5, 5, 'Squad aberto', 'Squad completo'],
    ['en', 3, 5, 'Open squad', '2 spots left — jump in'],
    ['en', 4, 5, 'Open squad', '1 spot left — jump in'],
    ['en', 5, 5, 'Open squad', 'Squad full'],
  ] as const)('writes a %s Squad with %i of %i', (language, filled, total, kicker, openSpots) => {
    expect(imageCopy(language, filled, total)).toEqual({ kicker, openSpots })
  })
})
