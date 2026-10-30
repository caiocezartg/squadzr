import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { squadQueryKey } from './squad-details'

export interface SquadDetailsCommands {
  /**
   * The viewer's Membership in a Squad changed: read its details again, for the Lobby on screen and for one
   * the cache only remembers. A Squad whose details were never read stays unread, and a read that fails
   * drops the details instead, so they are read again. It never rejects.
   */
  refreshSquadDetails: (squadCode: string) => Promise<void>
}

/**
 * The Squad details command other capabilities need. Joining a Squad describes what happened to the viewer
 * without knowing the details' query key, so a Lobby read as a non-member never outlives the join.
 */
export function useSquadDetailsCommands(): SquadDetailsCommands {
  const queryClient = useQueryClient()
  const refreshSquadDetails = useCallback(
    async (squadCode: string) => {
      const filters = { queryKey: squadQueryKey(squadCode), exact: true } as const
      try {
        await queryClient.refetchQueries({ ...filters, type: 'all' }, { throwOnError: true })
      } catch {
        // A read that failed leaves the details as they were, which are now wrong. Dropping them makes
        // the Lobby on screen read again, and any other visit read cold.
        queryClient.removeQueries(filters)
      }
    },
    [queryClient]
  )

  return useMemo(() => ({ refreshSquadDetails }), [refreshSquadDetails])
}
