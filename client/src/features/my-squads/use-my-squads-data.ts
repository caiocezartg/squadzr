import { useCallback, useState } from 'react'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { myRoomsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import type { MyRoomsResponse, Squad } from '@/types'
import { discardFailedMySquadsRead, mySquadsQueryKey } from './my-squads-cache'

/** Stable empty keeps the lists from changing identity while the query holds no data. */
const NO_SQUADS: MyRoomsResponse = { hosted: [], joined: [] }

export interface MySquadsData {
  readonly hosted: Squad[]
  readonly joined: Squad[]
  /** Re-reads the authoritative lists, e.g. after creating a Squad. */
  readonly refetch: () => Promise<unknown>
}

/**
 * Clears the list's failed reads once, before the page's first render, and returns the command
 * that clears them again for the reader's retry. A read that failed in an earlier visit stays in
 * the cache, and a suspending reader rethrows its error without reading, so without this a revisit
 * with a healthy API would show the old error. Call it before `useMySquadsBaseline`.
 */
export function useDiscardFailedMySquadsReads(): () => void {
  const queryClient = useQueryClient()
  useState(() => discardFailedMySquadsRead(queryClient))

  return useCallback(() => discardFailedMySquadsRead(queryClient), [queryClient])
}

/**
 * The list's update count when the page mounted. The view takes it once and passes it to the list,
 * so the count survives the list suspending and mounting again when the read lands.
 */
export function useMySquadsBaseline(): number {
  const queryClient = useQueryClient()
  const [baseline] = useState(
    () => queryClient.getQueryState(mySquadsQueryKey)?.dataUpdateCount ?? 0
  )

  return baseline
}

/**
 * The signed-in viewer's hosted and joined squads, read with `useSuspenseQuery`: a list the cache
 * holds renders at once, a list it lacks suspends, and a failed read throws to the page's error
 * boundary. The server prefetches the same key, so a hard load renders the list the server read.
 *
 * The list re-reads on mount, once per visit: My Squads has no realtime subscription, so changes
 * made while it is off screen would otherwise wait for the 60-second stale time. A list this visit
 * has already updated is not read again: the part that suspended on it mounts again once the list
 * lands, and that mount must not repeat the read it waited on.
 */
export function useMySquads(baseline: number): MySquadsData {
  const query = useSuspenseQuery({
    queryKey: mySquadsQueryKey,
    queryFn: () => api.get('/api/rooms/my', myRoomsResponseSchema),
    refetchOnMount: (query) => (query.state.dataUpdateCount === baseline ? 'always' : false),
    refetchOnWindowFocus: true,
  })

  // A 401 from the server read is stored as `null` (signed out); the route redirects before this
  // page renders, but a client refresh can observe it until the session check refreshes the route.
  const data = query.data ?? NO_SQUADS

  return { hosted: data.hosted, joined: data.joined, refetch: query.refetch }
}
