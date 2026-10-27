import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/**
 * The My Squads list's query key. It stays private to the capability: callers refresh the list
 * through the commands below, never through the key.
 */
export const mySquadsQueryKey = ['my-squads'] as const

export interface MySquadsCommands {
  /** The viewer's Memberships changed (a Squad was created, joined or left): read the list again. */
  refreshMySquads: () => Promise<void>
}

/**
 * The My Squads command other capabilities need. Creating, joining and leaving a Squad describe what
 * happened to the viewer's list without knowing its query key.
 */
export function useMySquadsCommands(): MySquadsCommands {
  const queryClient = useQueryClient()
  // Marks the list stale and reads it again while the sidebar shows it.
  const refreshMySquads = useCallback(
    () => queryClient.invalidateQueries({ queryKey: mySquadsQueryKey }).then(() => undefined),
    [queryClient]
  )

  return useMemo(() => ({ refreshMySquads }), [refreshMySquads])
}
