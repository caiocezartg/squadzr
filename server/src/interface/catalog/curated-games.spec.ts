import { describe, expect, it } from 'vitest'
import { CURATED_GAMES } from './curated-games'

// CCC-89: the curated list starts as today's 19 seed games with their seed-era
// ranges. Roblox keeps 50 in the data so the Catalog Import's 40 clamp is real.
describe('CURATED_GAMES', () => {
  it('keeps the 19 seed games with unique IGDB ids', () => {
    expect(CURATED_GAMES).toHaveLength(19)
    expect(new Set(CURATED_GAMES.map((game) => game.igdbId)).size).toBe(19)
  })

  it('keeps the seed-era ranges, including Roblox above the 40 clamp', () => {
    const roblox = CURATED_GAMES.find((game) => game.name === 'Roblox')
    const worldOfWarcraft = CURATED_GAMES.find((game) => game.name === 'World of Warcraft')

    expect(roblox).toMatchObject({ minPlayers: 2, maxPlayers: 50 })
    expect(worldOfWarcraft).toMatchObject({ minPlayers: 2, maxPlayers: 40 })
  })

  it('assigns distinct featured ranks', () => {
    const ranks = CURATED_GAMES.map((game) => game.featuredRank).filter((rank) => rank !== null)

    expect(ranks.length).toBeGreaterThan(0)
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it('keeps the verified ids of the ambiguous games', () => {
    expect(CURATED_GAMES.find((game) => game.name === 'Overwatch')).toMatchObject({
      igdbId: 125174,
    })
    expect(CURATED_GAMES.find((game) => game.name === 'GTA Online')).toMatchObject({
      igdbId: 134710,
    })
    expect(CURATED_GAMES.find((game) => game.name === 'EA Sports FC')).toMatchObject({
      igdbId: 353848,
    })
  })
})
