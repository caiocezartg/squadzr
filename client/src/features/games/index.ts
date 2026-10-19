/**
 * Public interface of the games capability. Squad surfaces that need the game
 * list import `useGames` and receive games and their load state, or
 * `useSuspenseGames` when they render from the list. `useGamesMap` indexes the
 * games by id, and `prefetchGames` lets a server route start the list read, and `discardFailedGames` clears a failed read for a second try. The
 * query key, endpoint and freshness stay internal.
 */
export {
  useGames,
  useSuspenseGames,
  prefetchGames,
  discardFailedGames,
  type GamesData,
  type UseGamesOptions,
} from './use-games'
export { useGamesMap } from './use-games-map'
