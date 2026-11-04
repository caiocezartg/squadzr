import { describe, expect, it } from 'vitest'
import { normalizeSearchText } from '@domain/services/search-text'
import { CURATED_GAMES } from './curated-games'
import { GAME_ALIASES } from './game-aliases'

// The IGDB names that differ from the curated (seed-era) names; the import stores the IGDB one,
// so an alias must differ from it, not from the curated name.
const IGDB_NAMES: ReadonlyMap<number, string> = new Map([
  [134710, 'Grand Theft Auto Online'],
  [353848, 'EA Sports FC 26'],
])

// #100: the manual alias map covers the acronyms IGDB lacks. The repository
// normalizes whatever it receives, so an entry that is not already normalized,
// or that repeats the game name, would hide a mistake.
describe('GAME_ALIASES', () => {
  it('is keyed by unique, positive IGDB ids', () => {
    const ids = [...GAME_ALIASES.keys()]

    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.every((id) => Number.isInteger(id) && id > 0)).toBe(true)
  })

  it('lists at least one alias per game, each already normalized and not blank', () => {
    for (const [igdbId, aliases] of GAME_ALIASES) {
      expect(aliases.length, `game ${igdbId}`).toBeGreaterThan(0)
      for (const alias of aliases) {
        expect(alias, `game ${igdbId}`).not.toBe('')
        expect(alias, `game ${igdbId}`).toBe(normalizeSearchText(alias))
      }
      expect(new Set(aliases).size, `game ${igdbId}`).toBe(aliases.length)
    }
  })

  it('never repeats the name the import stores for the game', () => {
    for (const game of CURATED_GAMES) {
      const name = IGDB_NAMES.get(game.igdbId) ?? game.name
      const aliases = GAME_ALIASES.get(game.igdbId) ?? []
      expect(aliases, name).not.toContain(normalizeSearchText(name))
    }
  })

  it('maps the main acronyms to the curated games', () => {
    const byName = (name: string) => CURATED_GAMES.find((game) => game.name === name)?.igdbId

    expect(GAME_ALIASES.get(byName('League of Legends')!)).toEqual(['lol'])
    expect(GAME_ALIASES.get(byName('Counter-Strike 2')!)).toEqual(['cs2', 'cs'])
    expect(GAME_ALIASES.get(byName('Rainbow Six Siege')!)).toEqual(['r6', 'r6s'])
  })
})
