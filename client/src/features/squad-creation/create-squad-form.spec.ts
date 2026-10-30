import { describe, expect, it } from 'vitest'
import { gameLol } from '../../test/fixtures'
import { NAME_MAX_LENGTH, PLAYER_LIMITS, defaultPlayers } from './create-squad-form'

describe('the form limits', () => {
  it('read the name and player limits from the contract', () => {
    expect(NAME_MAX_LENGTH).toBe(30)
    expect(PLAYER_LIMITS).toEqual({ min: 2, max: 40 })
  })
})

describe('defaultPlayers', () => {
  it('starts from the maximum of the game', () => {
    expect(defaultPlayers(gameLol)).toBe(5)
  })

  it('keeps a game with a count outside the limits inside them', () => {
    expect(defaultPlayers({ ...gameLol, maxPlayers: 1 })).toBe(2)
    expect(defaultPlayers({ ...gameLol, maxPlayers: 64 })).toBe(40)
  })
})
