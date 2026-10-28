import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { squadQueryKey } from './squad-details'

export interface SquadDetailsCommands {
  /**
   * The viewer's Membership in a Squad changed: read its details again, for the Lobby on screen and for one
   * the cache only remembers. A Squad whose details were never read stays unread.
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
    (squadCode: string) =>
      queryClient
        .refetchQueries({ queryKey: squadQueryKey(squadCode), exact: true, type: 'all' })
        .then(() => undefined),
    [queryClient]
  )

  return useMemo(() => ({ refreshSquadDetails }), [refreshSquadDetails])
}
