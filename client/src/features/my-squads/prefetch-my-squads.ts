import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadMySquads } from '@/lib/server/my-squads'
import type { RequestViewer } from '@/lib/server/viewer'
import { mySquadsQueryKey } from './my-squads-cache'

/**
 * Reads the viewer's hosted and joined Squads in the request's query client and settles when the read
 * has, so the sidebar's list is in the HTML. The server bounds the read at two seconds. It never
 * rejects: a failed read is logged and left out of the state the layout hands to the browser, so the
 * browser reads it again.
 */
export function prefetchMySquadsAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer
): Promise<void> {
  return queryClient.prefetchQuery({
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
