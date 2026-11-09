import 'server-only'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import type { AdminGamesParams } from '@/lib/admin-games-path'
import {
  loadAdminGame,
  loadAdminGames,
  loadAdminGamesSummary,
} from '@/lib/server/admin-catalog-games'
import type { RequestViewer } from '@/lib/server/viewer'
import { adminGameQueryKey, adminGamesQueryKey, adminGamesSummaryQueryKey } from './games-query'

/**
 * Reads one query in the request's query client and settles when the read has. It never rejects: a
 * failed read is logged and left out of the state the page hands to the browser, which reads it again.
 */
function prefetchLogged(
  queryClient: QueryClient,
  queryKey: QueryKey,
  what: string,
  load: () => Promise<unknown>
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn: async () => {
      try {
        return await load()
      } catch (error) {
        console.error(`${what} read failed; the browser reads it instead:`, error)
        throw error
      }
    },
    retry: false,
  })
}

/**
 * Reads the page of the Games list the URL asks for and the tab's summary, together, so both are in
 * the HTML the server sends. The server bounds each read at two seconds.
 */
export async function prefetchAdminGamesAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  params: AdminGamesParams
): Promise<void> {
  await Promise.all([
    prefetchLogged(queryClient, adminGamesQueryKey(params), 'Games', () =>
      loadAdminGames(viewer, params)
    ),
    prefetchLogged(queryClient, adminGamesSummaryQueryKey(), 'Games summary', () =>
      loadAdminGamesSummary(viewer)
    ),
  ])
}

/** The same for one game's page. */
export function prefetchAdminGameAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  id: string
): Promise<void> {
  return prefetchLogged(queryClient, adminGameQueryKey(id), 'Game', () => loadAdminGame(viewer, id))
}
