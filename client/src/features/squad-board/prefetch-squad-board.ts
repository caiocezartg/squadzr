import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { prefetchGames } from '@/features/games'
import { fetchGames } from '@/lib/server/games'
import { loadSquadBoard } from '@/lib/server/squad-board'
import type { RequestViewer } from '@/lib/server/viewer'
import { squadBoardQueryKey } from './squad-board-cache'

/**
 * Starts the Squad Board's reads in the request's query client: the complete squad list the viewer
 * sees, and the games it names. Nothing is awaited, so the page renders at once. A read still running
 * when the page's state is taken reaches the browser as a pending query, and the board suspends on it
 * only where it has no data. A failed read is logged, and the browser reads it again.
 */
export function prefetchSquadBoard(queryClient: QueryClient, viewer: RequestViewer): void {
  void queryClient.prefetchQuery({
    queryKey: squadBoardQueryKey,
    queryFn: logFailure('Squad Board read failed; the browser reads it instead:', () =>
      loadSquadBoard(viewer)
    ),
    retry: false,
  })
  void prefetchGames(
    queryClient,
    logFailure('Games read failed; the browser reads them instead:', fetchGames)
  )
}

/** Runs `read` and logs its failure before it rethrows, since a prefetch drops the error silently. */
function logFailure<T>(message: string, read: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await read()
    } catch (error) {
      console.error(message, error)
      throw error
    }
  }
}
