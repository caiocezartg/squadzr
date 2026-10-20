import { useSuspenseQuery } from '@tanstack/react-query'
import { gameResponseSchema, roomResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import {
  readSquadDetails,
  squadQueryKey,
  type DetailsSource,
  type SquadDetails,
} from './squad-details'

/** The browser's reads: the same two requests the server makes, sent with the session cookie. */
const browserSquadSource: DetailsSource = {
  readSquad: (squadCode) =>
    api.get(`/api/rooms/${encodeURIComponent(squadCode)}`, roomResponseSchema),
  readGame: (gameId) =>
    api
      .get(`/api/games/${encodeURIComponent(gameId)}`, gameResponseSchema)
      .then(({ game }) => game),
}

/**
 * The Squad's details, read with `useSuspenseQuery`: details the cache holds render at once, and details
 * it lacks suspend the Lobby's content. A hard load renders the details the server read, and a failed read
 * throws to the Lobby's error boundary. The realtime snapshot supersedes these details once it arrives.
 */
export function useSquadData(squadCode: string): SquadDetails | null {
  const { data } = useSuspenseQuery({
    queryKey: squadQueryKey(squadCode),
    queryFn: () => readSquadDetails(browserSquadSource, squadCode),
  })

  return data
}
