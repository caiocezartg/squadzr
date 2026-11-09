import { useQuery } from '@tanstack/react-query'
import { gameResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'

/**
 * The name of the Game the URL filters by, for the filter chip. The page's own rows already name it
 * (`knownName`); only when no row does (a filter that matches no Squad) is the Game read by its id.
 */
export function useFilteredGameName(gameId: string, knownName: string | null): string | null {
  const lookup = useQuery({
    queryKey: ['games', 'detail', gameId],
    queryFn: ({ signal }) =>
      api.get(`/api/games/${encodeURIComponent(gameId)}`, gameResponseSchema, signal),
    enabled: gameId !== '' && knownName === null,
    staleTime: 5 * 60_000,
  })
  if (gameId === '') return null
  return knownName ?? lookup.data?.game.name ?? null
}
