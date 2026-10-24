import { useSuspenseQuery } from '@tanstack/react-query'
import { roomResponseSchema, type RoomResponse } from '@squadzr/schemas'
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
