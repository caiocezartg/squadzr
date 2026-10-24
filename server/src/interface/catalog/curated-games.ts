import type { CuratedGame } from '@application/use-cases/game/catalog-import.use-case'

/**
 * The hand-picked games that keep their seed-era squad sizes and the featured
 * slots of the catalog. Keyed by IGDB id for the Catalog Import.
 *
 * The ids below were verified against the live IGDB v4 API in CCC-90. The
 * ambiguous mappings are Overwatch -> 125174 (the Overwatch 2 entry, renamed
 * "Overwatch" in 2026), GTA Online -> 134710 (the standalone GTA Online entry)
 * and EA Sports FC -> 353848 (EA Sports FC 26, the seed cover's game).
 *
 * Roblox keeps its 50 in the data on purpose, so the import's 40-player clamp
 * is exercised.
 */
export const CURATED_GAMES: readonly CuratedGame[] = [
  { igdbId: 17269, name: 'Roblox', minPlayers: 2, maxPlayers: 50, featuredRank: null },
  { igdbId: 135400, name: 'Minecraft', minPlayers: 2, maxPlayers: 10, featuredRank: null },
  { igdbId: 242408, name: 'Counter-Strike 2', minPlayers: 2, maxPlayers: 5, featuredRank: 1 },
  { igdbId: 1905, name: 'Fortnite', minPlayers: 2, maxPlayers: 4, featuredRank: 4 },
  { igdbId: 2963, name: 'Dota 2', minPlayers: 2, maxPlayers: 5, featuredRank: 5 },
  { igdbId: 115, name: 'League of Legends', minPlayers: 2, maxPlayers: 5, featuredRank: 2 },
  {
    igdbId: 27789,
    name: 'PUBG: Battlegrounds',
    minPlayers: 2,
    maxPlayers: 4,
    featuredRank: null,
  },
  { igdbId: 87622, name: 'Free Fire', minPlayers: 2, maxPlayers: 4, featuredRank: null },
  { igdbId: 126459, name: 'Valorant', minPlayers: 2, maxPlayers: 5, featuredRank: 3 },
  {
    igdbId: 217815,
    name: 'Call of Duty: Warzone',
    minPlayers: 2,
    maxPlayers: 4,
    featuredRank: null,
  },
  { igdbId: 114795, name: 'Apex Legends', minPlayers: 2, maxPlayers: 3, featuredRank: 6 },
  { igdbId: 134710, name: 'GTA Online', minPlayers: 2, maxPlayers: 30, featuredRank: null },
  { igdbId: 11198, name: 'Rocket League', minPlayers: 2, maxPlayers: 4, featuredRank: null },
  {
    igdbId: 7360,
    name: 'Rainbow Six Siege',
    minPlayers: 2,
    maxPlayers: 5,
    featuredRank: null,
  },
  { igdbId: 111469, name: 'Among Us', minPlayers: 4, maxPlayers: 15, featuredRank: null },
  { igdbId: 125174, name: 'Overwatch', minPlayers: 2, maxPlayers: 5, featuredRank: null },
  { igdbId: 123, name: 'World of Warcraft', minPlayers: 2, maxPlayers: 40, featuredRank: null },
  { igdbId: 353848, name: 'EA Sports FC', minPlayers: 2, maxPlayers: 22, featuredRank: null },
  { igdbId: 18866, name: 'Dead by Daylight', minPlayers: 2, maxPlayers: 5, featuredRank: null },
]
