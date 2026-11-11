import { describe, expect, it } from 'vitest'
import { imageCopy } from './copy'

describe('imageCopy', () => {
  it.each([
    ['pt-br', 3, 5, 'Squad aberto', 'Faltam 2 — entra aí'],
    ['pt-br', 4, 5, 'Squad aberto', 'Falta 1 — entra aí'],
    ['en', 3, 5, 'Open squad', '2 spots left — jump in'],
    ['en', 4, 5, 'Open squad', '1 spot left — jump in'],
  ] as const)('writes a %s Squad with %i of %i', (language, filled, total, kicker, status) => {
    expect(imageCopy(language, filled, total)).toEqual({ kicker, status })
  })

  it.each([
    ['pt-br', 'Squad completo', 'Todas as vagas preenchidas'],
    ['en', 'Squad full', 'Every slot is taken'],
  ] as const)('never calls a full %s Squad open', (language, kicker, status) => {
    const copy = imageCopy(language, 5, 5)

    expect(copy).toEqual({ kicker, status })
    expect(`${copy.kicker} ${copy.status}`).not.toMatch(/aberto|open/i)
  })
})
