import { useQuery, useSuspenseQuery, type QueryClient } from '@tanstack/react-query'
import { gamesResponseSchema, type GamesResponse } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { Game } from '@/types'

const gamesQueryKey = ['games'] as const

/** Stable empty keeps memo dependencies from changing while the query loads. */
const NO_GAMES: Game[] = []

export interface GamesData {
  games: Game[]
  loading: boolean
  error: boolean
}

export interface UseGamesOptions {
  /** Skips the request until the caller has what it needs (e.g. a session). */
  enabled?: boolean
}

function fetchGameList(): Promise<GamesResponse> {
  return api.get('/api/games', gamesResponseSchema)
}

/**
 * The game catalog shared by the squad surfaces. The query key, endpoint and
 * freshness stay here, so callers only see games and their load state.
 */
export function useGames({ enabled = true }: UseGamesOptions = {}): GamesData {
  const query = useQuery({
    queryKey: gamesQueryKey,
    queryFn: fetchGameList,
    staleTime: 60_000,
    enabled,
  })

  return {
    games: query.data?.games ?? NO_GAMES,
    loading: query.isLoading,
    error: query.isError,
  }
}

/**
 * The game catalog for a surface that renders from it. The component suspends until the list is in the
 * cache (a server read fills it) and a failed read throws to the surface's error boundary. The key and
 * freshness are the ones `useGames` uses.
 */
export function useSuspenseGames(): Game[] {
  const { data } = useSuspenseQuery({
    queryKey: gamesQueryKey,
    queryFn: fetchGameList,
    staleTime: 60_000,
  })

  return data.games
}

/**
 * Starts the game list read in `queryClient` under the games query key, so the first render can use
 * the games. The read is not awaited: the returned promise settles with it and never rejects.
 */
export function prefetchGames(
  queryClient: QueryClient,
  fetchList: () => Promise<GamesResponse>
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: gamesQueryKey,
    queryFn: fetchList,
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * Drops the game list when its read failed and left no data, so the next reader fetches it again. A
 * failed query stays in the cache and a suspending reader throws its error without reading, so a
 * surface that wants a second try calls this first. A list that holds data is left to its own refetch.
 */
export function discardFailedGames(queryClient: QueryClient): void {
  queryClient.removeQueries({
    queryKey: gamesQueryKey,
    exact: true,
    predicate: (query) => query.state.status === 'error' && query.state.data === undefined,
  })
}
