import type { GameAliases } from '@application/use-cases/game/catalog-import.use-case'

/**
 * Acronyms and nicknames Game Search needs and IGDB does not list, keyed by IGDB
 * id. They are merged with the alternative names IGDB returns and normalized by
 * the repository on write. Kept apart from `CURATED_GAMES`: an alias changes
 * neither the squad size nor the featured slots.
 *
 * Call of Duty: Modern Warfare 4 ("mw4") is not here yet: its IGDB id still has to be
 * confirmed against `POST /v4/games` (#100).
 */
export const GAME_ALIASES: GameAliases = new Map<number, readonly string[]>([
  [115, ['lol']], // League of Legends
  [242408, ['cs2', 'cs']], // Counter-Strike 2
  [126459, ['valo']], // Valorant
  [2963, ['dota']], // Dota 2
  [7360, ['r6', 'r6s']], // Rainbow Six Siege
  [27789, ['pubg']], // PUBG: Battlegrounds
  [123, ['wow']], // World of Warcraft
  [217815, ['wz']], // Call of Duty: Warzone
  [134710, ['gta', 'gta online']], // Grand Theft Auto Online
  [353848, ['fc', 'fifa']], // EA Sports FC
  [18866, ['dbd']], // Dead by Daylight
])
