import { useSyncExternalStore } from 'react'
import { notifyManager, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { isRoomLobbyResponse, roomResponseSchema, type RoomResponse } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { readSquadDetails, squadQueryKey, type SquadSource } from './squad-details'

/** The browser's read: the same request the server makes, sent with the session cookie. */
const browserSquadSource: SquadSource = {
  readSquad: (squadCode) =>
    api.get(`/api/rooms/${encodeURIComponent(squadCode)}`, roomResponseSchema),
}

/**
 * The Squad's details, read with `useSuspenseQuery`: details the cache holds render at once, and details
 * it lacks suspend the Lobby's content. A hard load renders the details the server read, and a failed read
 * throws to the Lobby's error boundary. The response carries the Squad's game summary. The realtime
 * snapshot supersedes these details once it arrives.
 */
export function useSquadData(squadCode: string): RoomResponse | null {
  const { data } = useSuspenseQuery({
    queryKey: squadQueryKey(squadCode),
    queryFn: () => readSquadDetails(browserSquadSource, squadCode),
  })

  return data
}

/** What the cache already knows of the viewer's place in a Squad: a member, not a member, or not known yet. */
export type SquadAccess = 'member' | 'non-member' | 'unknown'

/**
 * The viewer's place in a Squad, from the details the cache holds. It never reads and never subscribes as
 * an observer of the Squad's query: it only watches the cache's entry, so it works above the Lobby's
 * Suspense and flips when a join refreshes the details.
 */
export function useSquadAccess(squadCode: string): SquadAccess {
  const queryClient = useQueryClient()
  const readDetails = () => queryClient.getQueryData<RoomResponse | null>(squadQueryKey(squadCode))
  const details = useSyncExternalStore(
    // Batched like the query observers' own notifications: the cache changes while the Lobby's content renders,
    // and a page must not be told to update in the middle of another component's render.
    (onChange) => queryClient.getQueryCache().subscribe(notifyManager.batchCalls(onChange)),
    readDetails,
    readDetails
  )

  // A read that resolved to `null` (a missing Squad, or a Ready one the server hides from a non-member) is
  // known too: nothing in it is the viewer's to join live.
  if (details === undefined) return 'unknown'
  return details !== null && isRoomLobbyResponse(details) ? 'member' : 'non-member'
}
