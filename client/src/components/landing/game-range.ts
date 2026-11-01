import type { Game } from '@/types'

/** A game's squad size as the landing prints it: `2–5`, or one number when both ends match. */
export function gameRange(game: Pick<Game, 'minPlayers' | 'maxPlayers'>): string {
  return game.minPlayers === game.maxPlayers
    ? String(game.maxPlayers)
    : `${game.minPlayers}–${game.maxPlayers}`
}

/** The board filtered by the game's name. */
export function gameSquadsHref(game: Pick<Game, 'name'>): string {
  return `/squads?search=${encodeURIComponent(game.name)}`
}
