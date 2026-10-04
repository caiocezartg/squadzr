import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRoomsCache } from '@/hooks/use-rooms-cache'

/** The catalog query the lobby keeps in sync with its own room lifecycle. */
const ROOMS_QUERY_KEY = ['rooms'] as const

export interface CatalogCache {
  /** A room this tab was watching no longer exists in the catalog. */
  removeRoom: (roomId: string) => void
  /** Refetches the catalog after a Membership change. */
  refreshRooms: () => Promise<void>
}

/**
 * The catalog-cache commands the lobby needs. Keeping them here means the
 * route and the page never know query keys or cache mutations.
 */
export function useCatalogCache(): CatalogCache {
  const { removeRoom } = useRoomsCache()
  const queryClient = useQueryClient()

  const refreshRooms = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ROOMS_QUERY_KEY }).then(() => undefined),
    [queryClient]
  )

  return useMemo(() => ({ removeRoom, refreshRooms }), [removeRoom, refreshRooms])
}
