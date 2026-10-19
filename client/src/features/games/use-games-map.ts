import { useMemo } from 'react'
import type { Game } from '@/types'

/** The games keyed by id, so a card finds the game it names without scanning the list. */
export function useGamesMap(games: readonly Game[]): ReadonlyMap<string, Game> {
  return useMemo(() => new Map(games.map((game) => [game.id, game])), [games])
}
