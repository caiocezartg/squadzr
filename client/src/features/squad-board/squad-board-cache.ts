import { useCallback, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { discardFailedGames } from '@/features/games'
import type { RoomsResponse } from '@/types'

/**
 * The Squad Board's cache: its query key, the cache commands and the hook that
 * hands the commands to other capabilities. Confining them to one module lets
 * data, realtime and commands share the same key while callers describe intent
 * ("the board changed", "this squad is gone") without knowing it.
 */
export const squadBoardQueryKey = ['squads'] as const

/**
 * Drops the board's reads that failed and left no data, so the next reader fetches them again. A failed
 * query stays in the cache for its gcTime and a suspending reader throws its error without reading, so a
 * visit that follows a failure would show the same error with a healthy API. The board calls this when
 * it mounts and when the reader asks to try again.
 */
export function discardFailedBoardReads(queryClient: QueryClient): void {
  queryClient.removeQueries({
    queryKey: squadBoardQueryKey,
    exact: true,
    predicate: (query) => query.state.status === 'error' && query.state.data === undefined,
  })
  discardFailedGames(queryClient)
}

/** Marks the board stale and refetches it while it is mounted. */
export function invalidateSquadBoard(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: squadBoardQueryKey }).then(() => undefined)
}

/** Drops a squad this tab knows no longer exists, before the refetch lands. */
export function removeSquadFromBoard(queryClient: QueryClient, squadId: string): void {
  // A fetch already in flight resolves with the server list from before the
  // removal and would put the squad back on screen until the coalesced refetch
  // lands, so cancel it before dropping the squad. On a cold board there is
  // nothing to drop: the first fetch is the authoritative response itself.
  const hasCachedSquads = queryClient.getQueryData<RoomsResponse>(squadBoardQueryKey) !== undefined
  if (hasCachedSquads) {
    void queryClient.cancelQueries({ queryKey: squadBoardQueryKey })
  }

  queryClient.setQueryData<RoomsResponse>(squadBoardQueryKey, (old) => {
    // Never fabricate an empty board: without cached squads the query must
    // stay pending so the mount fetch (or the coalesced refetch) loads it.
    if (!old) return old
    return { rooms: old.rooms.filter((squad) => squad.id !== squadId) }
  })
}

export interface SquadBoardCommands {
  /** A squad this tab was watching no longer exists on the board. */
  removeSquad: (squadId: string) => void
  /** Refetches the board after a Membership change. */
  refreshSquads: () => Promise<void>
}

/**
 * The Squad Board commands other capabilities need. Exposing them through the
 * capability's public interface means callers describe what happened to the
 * board without knowing query keys or cache mutations.
 */
export function useSquadBoardCommands(): SquadBoardCommands {
  const queryClient = useQueryClient()

  const removeSquad = useCallback(
    (squadId: string) => removeSquadFromBoard(queryClient, squadId),
    [queryClient]
  )

  const refreshSquads = useCallback(() => invalidateSquadBoard(queryClient), [queryClient])

  return useMemo(() => ({ removeSquad, refreshSquads }), [removeSquad, refreshSquads])
}
