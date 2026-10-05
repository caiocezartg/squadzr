import type { QueryClient } from '@tanstack/react-query'
import type { RoomsResponse } from '@/types'

/**
 * The catalog's query key and cache commands. Confining them to one module
 * lets data, realtime and commands share the same key while callers describe
 * intent ("the catalog changed", "this room is gone") without knowing it.
 */
export const catalogRoomsQueryKey = ['rooms'] as const

/** Marks the catalog stale and refetches it while it is mounted. */
export function invalidateCatalogRooms(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: catalogRoomsQueryKey }).then(() => undefined)
}

/** Drops a room this tab knows no longer exists, before the refetch lands. */
export function removeCatalogRoom(queryClient: QueryClient, roomId: string): void {
  // A fetch already in flight resolves with the server list from before the
  // removal and would put the room back on screen until the coalesced refetch
  // lands, so cancel it before dropping the room. On a cold catalog there is
  // nothing to drop: the first fetch is the authoritative response itself.
  const hasCachedRooms = queryClient.getQueryData<RoomsResponse>(catalogRoomsQueryKey) !== undefined
  if (hasCachedRooms) {
    void queryClient.cancelQueries({ queryKey: catalogRoomsQueryKey })
  }

  queryClient.setQueryData<RoomsResponse>(catalogRoomsQueryKey, (old) => {
    // Never fabricate an empty catalog: without cached rooms the query must
    // stay pending so the mount fetch (or the coalesced refetch) loads it.
    if (!old) return old
    return { rooms: old.rooms.filter((room) => room.id !== roomId) }
  })
}
