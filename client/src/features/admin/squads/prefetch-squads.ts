import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadAdminSquads } from '@/lib/server/admin-squads'
import type { RequestViewer } from '@/lib/server/viewer'
import { adminSquadsQueryKey } from './squads-query'

/**
 * Reads one page of the Open Squads in the request's query client and settles when the read has, so the
 * table is in the HTML the server sends. The server bounds the read at two seconds. It never rejects:
 * a failed read is logged and left out of the state the page hands to the browser, which reads it again.
 */
export function prefetchAdminSquadsAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  search: string,
  gameId: string,
  page: number
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: adminSquadsQueryKey(search, gameId, page),
    queryFn: async () => {
      try {
        return await loadAdminSquads(viewer, search, gameId, page)
      } catch (error) {
        console.error('Squads read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}
