import { describe, expect, it } from 'vitest'
import { buildSearchText, normalizeAliases, normalizeSearchText } from './search-text'

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

describe('normalizeAliases', () => {
  it('folds, dedupes and drops blanks and the Game name itself', () => {
    expect(
      normalizeAliases('Counter-Strike 2', [
        'CS2',
        'cs 2',
        'cs2',
        '  ',
        '!!',
        'Counter Strike 2',
        'CS:2',
      ])
    ).toEqual(['cs2', 'cs 2'])
  })

  it('returns an empty list when there is nothing to keep', () => {
    expect(normalizeAliases('Valorant', [])).toEqual([])
  })
})

describe('buildSearchText', () => {
  it('joins the folded name and the aliases with " | "', () => {
    expect(buildSearchText('Pokémon UNITE', ['pkmn unite'])).toBe('pokemon unite | pkmn unite')
  })

  it('is the folded name alone when there are no aliases', () => {
    expect(buildSearchText('Dota 2', [])).toBe('dota 2')
  })
})
