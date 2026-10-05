import { useQuery } from '@tanstack/react-query'
import { roomsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { useGames } from '@/features/games'
import type { Game, PublicRoom } from '@/types'
import { catalogRoomsQueryKey } from './catalog-query'

/** Stable empty keeps memo dependencies from changing while the rooms query loads. */
const NO_ROOMS: PublicRoom[] = []

export interface CatalogData {
  rooms: PublicRoom[]
  roomsLoading: boolean
  roomsError: boolean
  games: Game[]
  gamesLoading: boolean
  gamesError: boolean
}

/**
 * The catalog's HTTP data. The list comes from the public rooms contract (no
 * invite, no roster); the query key stays here, so the page only sees rooms
 * and games. The games come from the games capability, refetches after a local
 * mutation are a command of the capability (`useCatalogCommands`), so the page
 * never owns a duplicate.
 *
 * The rooms list always re-reads on mount: outside the catalog its realtime
 * channel is not subscribed, so events from other people are missed and a
 * cache younger than the global staleTime would look fresh without being
 * fresh. The cached list still paints immediately while the single GET of the
 * visit lands.
 */
export function useCatalogData(): CatalogData {
  const roomsQuery = useQuery({
    queryKey: catalogRoomsQueryKey,
    queryFn: () => api.get('/api/rooms', roomsResponseSchema),
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const gamesQuery = useGames()

  return {
    rooms: roomsQuery.data?.rooms ?? NO_ROOMS,
    roomsLoading: roomsQuery.isLoading,
    roomsError: roomsQuery.isError,
    games: gamesQuery.games,
    gamesLoading: gamesQuery.loading,
    gamesError: gamesQuery.error,
  }
}
