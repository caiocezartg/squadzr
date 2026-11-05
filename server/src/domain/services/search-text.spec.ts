import { describe, expect, it } from 'vitest'
import { buildSearchText, normalizeAliases } from './search-text'

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
