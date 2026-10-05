/**
 * Public interface of the games capability. Room surfaces that need the game
 * list import `useGames` and receive games and their load state; the query
 * key, endpoint and freshness stay internal.
 */
export { useGames, type GamesData, type UseGamesOptions } from './use-games'
