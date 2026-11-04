import { describe, expect, it } from 'vitest'
import { findMatchRange, normalizeSearchText } from './search-text'

// #105: the client folds a game name and the typed term like the server's Game Search does, to
// highlight the part of the name that answers the term. The folding examples are the server's
// (server/src/domain/services/search-text.spec.ts); keep them in step.
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

/** The part of `name` that `findMatchRange` marks, or `null`. */
function matched(name: string, term: string): string | null {
  const range = findMatchRange(name, term)
  return range ? name.slice(range[0], range[1]) : null
}

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
