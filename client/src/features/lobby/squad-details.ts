import type { QueryClient } from '@tanstack/react-query'
import { roomCodeParamSchema, type RoomResponse } from '@squadzr/schemas'
import { ApiClientError } from '@/lib/api-contract'

/** The one read of a Squad: the server and the browser each provide their own. */
export interface SquadSource {
  readSquad(squadCode: string): Promise<RoomResponse>
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
 * both read as `null`, which the Lobby shows as a missing Squad. Any other failure of the Squad read
 * throws. The response carries the Squad's game summary, so the Lobby and its link preview never read
 * the catalog separately.
 */
export async function readSquadDetails(
  source: SquadSource,
  squadCode: string
): Promise<RoomResponse | null> {
  const parsed = roomCodeParamSchema.safeParse({ code: squadCode })
  if (!parsed.success) return null

  try {
    return await source.readSquad(parsed.data.code)
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null
    throw error
  }
}
