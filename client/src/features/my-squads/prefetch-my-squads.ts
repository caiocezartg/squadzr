import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { prefetchGames } from '@/features/games'
import { fetchGames } from '@/lib/server/games'
import { loadMySquads } from '@/lib/server/my-squads'
import type { RequestViewer } from '@/lib/server/viewer'
import { mySquadsQueryKey } from './my-squads-cache'

/**
 * Starts My Squads' reads in the request's query client: the viewer's hosted and joined Squads, and
 * the games the cards name. Nothing is awaited, so the page renders at once. A read still running
 * when the page's state is taken reaches the browser as a pending query, and the list suspends on
 * it only where it has no data. A failed read is logged, and the browser reads it again.
 */
export function prefetchMySquads(queryClient: QueryClient, viewer: RequestViewer): void {
  void queryClient.prefetchQuery({
    queryKey: mySquadsQueryKey,
    queryFn: logFailure('My Squads read failed; the browser reads it instead:', () =>
      loadMySquads(viewer)
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
