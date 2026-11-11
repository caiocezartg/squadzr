import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import type { RequestViewer } from '@/lib/server/viewer'
import { viewerSquadSource } from './server-squad-source'
import { readSquadDetails, squadQueryKey } from './squad-details'

/**
 * Starts the Lobby's Squad read in the request's query client, for the viewer. Nothing is awaited, so the
 * page renders at once: a read still running when the page's state is taken reaches the browser as a
 * pending query, and the Lobby suspends on it only where it has no data. A failed read is logged, and the
 * browser reads the Squad again.
 */
export function prefetchLobby(
  queryClient: QueryClient,
  viewer: RequestViewer,
  squadCode: string
): void {
  void queryClient.prefetchQuery({
    queryKey: squadQueryKey(squadCode),
    queryFn: async () => {
      try {
        return await readSquadDetails(viewerSquadSource(viewer), squadCode)
      } catch (error) {
        console.error('Lobby read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}
