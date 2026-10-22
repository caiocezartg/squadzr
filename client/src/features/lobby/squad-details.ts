import type { QueryClient } from '@tanstack/react-query'
import { roomCodeParamSchema, type RoomResponse } from '@squadzr/schemas'
import { ApiClientError } from '@/lib/api-contract'
import type { Game } from '@/types'

/** What the Lobby shows: the Squad's HTTP projection (the member view for a member) and its game. */
export interface SquadDetails {
  readonly response: RoomResponse
  /** The game's name and cover. Null when the game read failed, so the Lobby renders without them. */
  readonly game: Game | null
}

/** The two reads of a Squad's details. The server and the browser each provide their own. */
export interface DetailsSource {
  readSquad(squadCode: string): Promise<RoomResponse>
  readGame(gameId: string): Promise<Game>
}

/** The query key of a Squad's details. The code is uppercased, as the contract carries it. */
export function squadQueryKey(squadCode: string) {
  return ['squad', squadCode.toUpperCase()] as const
}

/**
 * Drops a Squad's read when it failed and left no data. A suspending reader rethrows a failed query without
 * reading again, so a visit after a failure would show the old error while the API is healthy.
 */
export function discardFailedSquadRead(queryClient: QueryClient, squadCode: string): void {
  queryClient.removeQueries({
    queryKey: squadQueryKey(squadCode),
    exact: true,
    predicate: (query) => query.state.status === 'error' && query.state.data === undefined,
  })
}

/**
 * Reads a Squad's details. A code the shared contract rejects, and a Squad the viewer cannot see (a 404),
 * both read as `null`, which the Lobby shows as a missing Squad. A failed game read leaves the game out.
 * Any other failure of the Squad read throws.
 */
export async function readSquadDetails(
  source: DetailsSource,
  squadCode: string
): Promise<SquadDetails | null> {
  const parsed = roomCodeParamSchema.safeParse({ code: squadCode })
  if (!parsed.success) return null

  let response: RoomResponse
  try {
    response = await source.readSquad(parsed.data.code)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null
    throw error
  }

  return { response, game: await readGame(source, response.room.gameId) }
}

async function readGame(source: DetailsSource, gameId: string): Promise<Game | null> {
  try {
    return await source.readGame(gameId)
  } catch (error) {
    console.error('Game read failed; the Lobby renders without the game:', error)
    return null
  }
}
