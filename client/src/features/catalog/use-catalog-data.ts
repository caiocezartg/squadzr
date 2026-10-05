import { useQuery } from '@tanstack/react-query'
import { gamesResponseSchema, roomsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { Game, PublicRoom } from '@/types'
import { catalogRoomsQueryKey } from './catalog-query'

/** Stable empties keep memo dependencies from changing while a query loads. */
const NO_ROOMS: PublicRoom[] = []
const NO_GAMES: Game[] = []

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
 * and games. Refreshes after a local mutation are a command of the capability
 * (`useCatalogCommands`), so the page never owns a duplicate.
 */
export function useCatalogData(): CatalogData {
  const roomsQuery = useQuery({
    queryKey: catalogRoomsQueryKey,
    queryFn: () => api.get('/api/rooms', roomsResponseSchema),
    refetchOnWindowFocus: true,
  })

  const gamesQuery = useQuery({
    queryKey: ['games'],
    queryFn: () => api.get('/api/games', gamesResponseSchema),
    staleTime: 60_000,
  })

  return {
    rooms: roomsQuery.data?.rooms ?? NO_ROOMS,
    roomsLoading: roomsQuery.isLoading,
    roomsError: roomsQuery.isError,
    games: gamesQuery.data?.games ?? NO_GAMES,
    gamesLoading: gamesQuery.isLoading,
    gamesError: gamesQuery.isError,
  }
}
