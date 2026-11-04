import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from './search-text'

describe('normalizeSearchText', () => {
  it.each([
    ['Counter-Strike 2', 'counter strike 2'],
    ['Pokémon UNITE', 'pokemon unite'],
    ['Call of Duty: Modern Warfare', 'call of duty modern warfare'],
    ['  League   of \t Legends  ', 'league of legends'],
    ['100% Cup', '100 cup'],
    ['half_life', 'half life'],
    ['back\\slash', 'back slash'],
    ['Ünïcödé Ñandú', 'unicode nandu'],
    ['ＬＯＬ', 'lol'],
  ])('folds %j to %j', (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected)
  })

  it.each(['%_\\', '%', '_', '   ', '', '!!! ---'])(
    'folds %j, only punctuation, to ""',
    (input) => {
      expect(normalizeSearchText(input)).toBe('')
    }
  )

  it('is idempotent', () => {
    const once = normalizeSearchText('Pokémon: Sword & Shield!')
    expect(normalizeSearchText(once)).toBe(once)
  })
})
