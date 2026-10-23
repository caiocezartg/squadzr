import type { CuratedGame } from '@application/use-cases/game/catalog-import.use-case'

/**
 * The hand-picked games that keep their seed-era squad sizes and the featured
 * slots of the catalog. Keyed by IGDB id for the Catalog Import.
 *
 * The IGDB ids below are placeholders: CCC-90 verifies them against the real
 * IGDB API before the production source starts using this list. Roblox keeps
 * its 50 in the data on purpose, so the import's 40-player clamp is exercised.
 */
export const CURATED_GAMES: readonly CuratedGame[] = [
  { igdbId: 100001, name: 'Roblox', minPlayers: 2, maxPlayers: 50, featuredRank: null },
  { igdbId: 100002, name: 'Minecraft', minPlayers: 2, maxPlayers: 10, featuredRank: null },
  { igdbId: 100003, name: 'Counter-Strike 2', minPlayers: 2, maxPlayers: 5, featuredRank: 1 },
  { igdbId: 100004, name: 'Fortnite', minPlayers: 2, maxPlayers: 4, featuredRank: 4 },
  { igdbId: 100005, name: 'Dota 2', minPlayers: 2, maxPlayers: 5, featuredRank: 5 },
  { igdbId: 100006, name: 'League of Legends', minPlayers: 2, maxPlayers: 5, featuredRank: 2 },
  { igdbId: 100007, name: 'PUBG: Battlegrounds', minPlayers: 2, maxPlayers: 4, featuredRank: null },
  { igdbId: 100008, name: 'Free Fire', minPlayers: 2, maxPlayers: 4, featuredRank: null },
  { igdbId: 100009, name: 'Valorant', minPlayers: 2, maxPlayers: 5, featuredRank: 3 },
  {
    igdbId: 100010,
    name: 'Call of Duty: Warzone',
    minPlayers: 2,
    maxPlayers: 4,
    featuredRank: null,
  },
  { igdbId: 100011, name: 'Apex Legends', minPlayers: 2, maxPlayers: 3, featuredRank: 6 },
  { igdbId: 100012, name: 'GTA Online', minPlayers: 2, maxPlayers: 30, featuredRank: null },
  { igdbId: 100013, name: 'Rocket League', minPlayers: 2, maxPlayers: 4, featuredRank: null },
  { igdbId: 100014, name: 'Rainbow Six Siege', minPlayers: 2, maxPlayers: 5, featuredRank: null },
  { igdbId: 100015, name: 'Among Us', minPlayers: 4, maxPlayers: 15, featuredRank: null },
  { igdbId: 100016, name: 'Overwatch', minPlayers: 2, maxPlayers: 5, featuredRank: null },
  { igdbId: 100017, name: 'World of Warcraft', minPlayers: 2, maxPlayers: 40, featuredRank: null },
  { igdbId: 100018, name: 'EA Sports FC', minPlayers: 2, maxPlayers: 22, featuredRank: null },
  { igdbId: 100019, name: 'Dead by Daylight', minPlayers: 2, maxPlayers: 5, featuredRank: null },
]
