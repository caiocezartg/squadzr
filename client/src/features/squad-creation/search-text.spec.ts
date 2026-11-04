import { normalizeSearchText } from '@squadzr/schemas'
import { describe, expect, it } from 'vitest'
import { findMatchRange, foldWithOrigins } from './search-text'

/** The part of `name` that `findMatchRange` marks, or `null`. */
function matched(name: string, term: string): string | null {
  const range = findMatchRange(name, term)
  return range ? name.slice(range[0], range[1]) : null
}

// Every example of the shared normalizeSearchText spec (packages/schemas/src/search-text.spec.ts),
// plus texts with ligatures and astral characters, which the highlight must fold the same way.
describe('foldWithOrigins', () => {
  it.each([
    'Counter-Strike 2',
    'Pokémon UNITE',
    'Call of Duty: Modern Warfare',
    '  League   of \t Legends  ',
    '100% Cup',
    'half_life',
    'back\\slash',
    'Ünïcödé Ñandú',
    'ＬＯＬ',
    'Fﬁnal Fantasy',
    '𠀀 Valorant',
    '𝐀rena',
    'ＬＯＬ Arena',
    '--half_life!!',
    '%_\\',
    '%',
    '_',
    '   ',
    '',
    '!!! ---',
    'Pokémon: Sword & Shield!',
  ])('folds %j to the same text as normalizeSearchText', (input) => {
    expect(foldWithOrigins(input).text).toBe(normalizeSearchText(input))
  })
})

describe('findMatchRange', () => {
  it.each([
    ['Pokémon Go', 'pokemon', 'Pokémon'],
    ['Pokémon Go', 'POKÉMON', 'Pokémon'],
    ['Counter-Strike 2', 'counter strike', 'Counter-Strike'],
    ['Counter-Strike 2', 'counter-strike 2', 'Counter-Strike 2'],
    ['Counter-Strike 2', 'strike 2', 'Strike 2'],
    ['Call of Duty: Modern Warfare', 'duty modern', 'Duty: Modern'],
    ['League of Legends', 'legends', 'Legends'],
    ['League of Legends', 'of  leg', 'of Leg'],
    ['  Half_Life', 'half life', 'Half_Life'],
    ['Ünïcödé Ñandú', 'unicode', 'Ünïcödé'],
    ['ＬＯＬ Arena', 'lol', 'ＬＯＬ'],
    ['Dota 2', '2', '2'],
    ['Fﬁnal Fantasy', 'final', 'ﬁnal'],
    ['𠀀 Valorant', 'valorant', 'Valorant'],
    ['𝐀rena', 'rena', 'rena'],
  ])('marks %j for %j as %j', (name, term, expected) => {
    expect(matched(name, term)).toBe(expected)
  })

  it('marks the first occurrence', () => {
    expect(findMatchRange('Strike Strike', 'strike')).toEqual([0, 6])
  })

  it('gives offsets into the original name, not the folded one', () => {
    expect(findMatchRange('Pokémon Go', 'go')).toEqual([8, 10])
    expect(findMatchRange('--Counter-Strike', 'strike')).toEqual([10, 16])
  })

  it.each([
    ['League of Legends', 'lol'],
    ['Lost Ark', 'lol'],
    ['Counter-Strike 2', 'cs2'],
    ['Valorant', 'valorat quest'],
    ['Valorant', ''],
    ['Valorant', '   '],
    ['Valorant', '%'],
    ['', 'a'],
  ])('marks nothing in %j for %j', (name, term) => {
    expect(findMatchRange(name, term)).toBeNull()
  })
})
