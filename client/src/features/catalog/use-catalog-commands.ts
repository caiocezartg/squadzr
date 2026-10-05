import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateCatalogRooms, removeCatalogRoom } from './catalog-query'

export interface CatalogCommands {
  /** A room this tab was watching no longer exists in the catalog. */
  removeRoom: (roomId: string) => void
  /** Refetches the catalog after a Membership change. */
  refreshRooms: () => Promise<void>
}

/**
 * The catalog commands other capabilities need. Exposing them through the
 * capability's public interface means callers describe what happened to the
 * catalog without knowing query keys or cache mutations.
 */
export function useCatalogCommands(): CatalogCommands {
  const queryClient = useQueryClient()

  const removeRoom = useCallback(
    (roomId: string) => removeCatalogRoom(queryClient, roomId),
    [queryClient]
  )

  const refreshRooms = useCallback(() => invalidateCatalogRooms(queryClient), [queryClient])

  return useMemo(() => ({ removeRoom, refreshRooms }), [removeRoom, refreshRooms])
}
