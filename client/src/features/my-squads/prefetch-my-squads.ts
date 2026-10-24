import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadMySquads } from '@/lib/server/my-squads'
import type { RequestViewer } from '@/lib/server/viewer'
import { mySquadsQueryKey } from './my-squads-cache'

/**
 * Starts My Squads' read in the request's query client: the viewer's hosted and joined Squads, each
 * carrying its game summary. Nothing is awaited, so the page renders at once. A read still running
 * when the page's state is taken reaches the browser as a pending query, and the list suspends on it
 * only where it has no data. A failed read is logged, and the browser reads it again.
 */
export function prefetchMySquads(queryClient: QueryClient, viewer: RequestViewer): void {
  void queryClient.prefetchQuery({
    queryKey: mySquadsQueryKey,
    queryFn: async () => {
      try {
        return await loadMySquads(viewer)
      } catch (error) {
        console.error('My Squads read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}
