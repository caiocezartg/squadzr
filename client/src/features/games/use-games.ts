import { useQuery } from '@tanstack/react-query'
import { gamesResponseSchema } from '@squadzr/schemas'
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

/**
 * The game catalog shared by the room surfaces. The query key, endpoint and
 * freshness stay here, so callers only see games and their load state.
 */
export function useGames({ enabled = true }: UseGamesOptions = {}): GamesData {
  const query = useQuery({
    queryKey: gamesQueryKey,
    queryFn: () => api.get('/api/games', gamesResponseSchema),
    staleTime: 60_000,
    enabled,
  })

  return {
    games: query.data?.games ?? NO_GAMES,
    loading: query.isLoading,
    error: query.isError,
  }
}
