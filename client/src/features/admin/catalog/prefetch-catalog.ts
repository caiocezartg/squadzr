import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadCatalogImportRuns } from '@/lib/server/admin-catalog'
import type { RequestViewer } from '@/lib/server/viewer'
import { catalogRunsQueryKey } from './catalog-query'

/**
 * Reads one page of the run history in the request's query client and settles when the read has, so
 * the table is in the HTML the server sends. The server bounds the read at two seconds. It never
 * rejects: a failed read is logged and left out of the state the page hands to the browser, so the
 * browser reads it again.
 */
export function prefetchCatalogImportRunsAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  page: number
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: catalogRunsQueryKey(page),
    queryFn: async () => {
      try {
        return await loadCatalogImportRuns(viewer, page)
      } catch (error) {
        console.error(
          'Catalog Import Run history read failed; the browser reads it instead:',
          error
        )
        throw error
      }
    },
    retry: false,
  })
}
