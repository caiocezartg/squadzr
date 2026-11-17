import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SquadSnapshot } from './squad-snapshot'

/** The query key of a Squad's last snapshot. The code is uppercased, as the contract carries it. */
export function squadSnapshotQueryKey(squadCode: string) {
  return ['squad-snapshot', squadCode.toUpperCase()] as const
}

export interface SquadSnapshotCache {
  /** The last snapshot this viewer saw for the Squad, or `null` on a cold cache. */
  read: (squadCode: string) => SquadSnapshot | null
  /** Remembers the Squad's latest snapshot, replacing the previous one. */
  write: (squadCode: string, snapshot: SquadSnapshot) => void
  /** The viewer lost access to the Squad: the roster it holds is no longer theirs to show. */
  discard: (squadCode: string) => void
}

/**
 * Keeps each Squad's last snapshot across Lobby mounts in the query cache, so a return renders the roster
 * it already knows while the socket delivers the fresh snapshot. The entry has no reader or fetcher, so it
 * lives for the app's `gcTime` and then goes: a discarded cache, or a new session (sign-out clears the
 * client), is a cold load again.
 */
export function useSquadSnapshotCache(): SquadSnapshotCache {
  const queryClient = useQueryClient()
  return useMemo(
    () => ({
      read: (squadCode) =>
        queryClient.getQueryData<SquadSnapshot>(squadSnapshotQueryKey(squadCode)) ?? null,
      write: (squadCode, snapshot) =>
        queryClient.setQueryData(squadSnapshotQueryKey(squadCode), snapshot),
      discard: (squadCode) =>
        queryClient.removeQueries({ queryKey: squadSnapshotQueryKey(squadCode), exact: true }),
    }),
    [queryClient]
  )
}
