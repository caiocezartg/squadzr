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
  queryClient.setQueryData<RoomsResponse>(catalogRoomsQueryKey, (old) => {
    if (!old) return { rooms: [] }
    return { rooms: old.rooms.filter((room) => room.id !== roomId) }
  })
}
