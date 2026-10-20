import { useCallback, useState } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { roomsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { PublicSquad } from '@/types'
import { discardFailedBoardReads, squadBoardQueryKey } from './squad-board-cache'

/**
 * Clears the board's failed reads once, before the board's first render, and returns the command that
 * clears them again for the reader's retry. A read that failed in an earlier visit stays in the cache,
 * and a suspending reader rethrows its error without reading, so without this a revisit with a healthy
 * API would show the old error. Call it before `useSquadBoardBaseline`, which counts updates after the
 * failed reads are gone.
 */
export function useDiscardFailedBoardReads(): () => void {
  const queryClient = useQueryClient()
  useState(() => discardFailedBoardReads(queryClient))

  return useCallback(() => discardFailedBoardReads(queryClient), [queryClient])
}

/**
 * The list's update count when the board mounted. The view takes it once and passes it to every part of
 * the board, so the count survives a part that suspends on the list and mounts again when the list lands.
 */
export function useSquadBoardBaseline(): number {
  const queryClient = useQueryClient()
  const [baseline] = useState(
    () => queryClient.getQueryState(squadBoardQueryKey)?.dataUpdateCount ?? 0
  )

  return baseline
}

/**
 * The board's squads, read with `useSuspenseQuery`: a list the cache holds renders at once, a list it
 * lacks suspends the component, and a failed read throws to the board's error boundary. The list comes
 * from the public rooms contract (no invite, no roster); the query key stays here, so the board only
 * sees squads.
 *
 * The board re-reads its list on mount, once per visit. Outside the board its realtime channel is not
 * subscribed, so events from other people are missed, and a cache younger than the global staleTime
 * would look fresh without being fresh. A list this visit has already updated is not read again: the
 * part that suspended on it mounts again once the list lands, and that mount must not repeat the read
 * it waited on. On a cold visit the page's read is the one the board waits on, so the mount joins it.
 */
export function useSquadBoardSquads(baseline: number): PublicSquad[] {
  const { data } = useSuspenseQuery({
    queryKey: squadBoardQueryKey,
    queryFn: () => api.get('/api/rooms', roomsResponseSchema),
    refetchOnMount: (query) => (query.state.dataUpdateCount === baseline ? 'always' : false),
    refetchOnWindowFocus: true,
  })

  return data.rooms
}
