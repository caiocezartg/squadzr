import { useQuery } from '@tanstack/react-query'
import { myRoomsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { Room } from '@/types'

/**
 * The My Rooms query key. It stays private to the capability: callers refresh
 * their own data through the hook that owns the query, never through the key.
 */
const myRoomsQueryKey = ['my-rooms'] as const

/** Stable empties keep memo dependencies from changing while the query loads. */
const NO_ROOMS: Room[] = []

export interface MyRoomsData {
  hosted: Room[]
  joined: Room[]
  loading: boolean
  error: boolean
  /** Re-reads the authoritative lists, e.g. after creating a room. */
  refetch: () => Promise<unknown>
}

/**
 * The room lists the signed-in user hosts or belongs to. The server applies
 * the lifecycle rules: Open Rooms plus Ready Rooms still inside their
 * 60-minute retention window are returned, and a room leaves the lists at the
 * deadline even before physical cleanup. The page renders whatever the server
 * returns and never filters Ready rooms on its own.
 */
export function useMyRoomsData(enabled: boolean): MyRoomsData {
  const query = useQuery({
    queryKey: myRoomsQueryKey,
    queryFn: () => api.get('/api/rooms/my', myRoomsResponseSchema),
    enabled,
    refetchOnWindowFocus: true,
  })

  return {
    hosted: query.data?.hosted ?? NO_ROOMS,
    joined: query.data?.joined ?? NO_ROOMS,
    loading: query.isLoading,
    error: query.isError,
    refetch: query.refetch,
  }
}
