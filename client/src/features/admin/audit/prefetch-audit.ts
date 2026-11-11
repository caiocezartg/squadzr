import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadAuditEntries } from '@/lib/server/admin-audit'
import type { RequestViewer } from '@/lib/server/viewer'
import { auditQueryKey } from './audit-query'

/**
 * Reads one page of the audit in the request's query client and settles when the read has, so the
 * table is in the HTML the server sends. The server bounds the read at two seconds. It never rejects:
 * a failed read is logged and left out of the state the page hands to the browser, so the browser
 * reads it again.
 */
export function prefetchAuditEntriesAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  page: number
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: auditQueryKey(page),
    queryFn: async () => {
      try {
        return await loadAuditEntries(viewer, page)
      } catch (error) {
        console.error('Audit read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}
