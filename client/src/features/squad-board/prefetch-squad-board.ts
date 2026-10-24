import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadSquadBoard } from '@/lib/server/squad-board'
import type { RequestViewer } from '@/lib/server/viewer'
import { squadBoardQueryKey } from './squad-board-cache'

/**
 * Starts the Squad Board's read in the request's query client: the complete squad list the viewer
 * sees. Each Squad carries its game summary, so no catalog read is needed. Nothing is awaited, so the
 * page renders at once. A read still running when the page's state is taken reaches the browser as a
 * pending query, and the board suspends on it only where it has no data. A failed read is logged, and
 * the browser reads it again.
 */
export function prefetchSquadBoard(queryClient: QueryClient, viewer: RequestViewer): void {
  void queryClient.prefetchQuery({
    queryKey: squadBoardQueryKey,
    queryFn: async () => {
      try {
        return await loadSquadBoard(viewer)
      } catch (error) {
        console.error('Squad Board read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}
