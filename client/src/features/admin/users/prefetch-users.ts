import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { loadAdminUser, loadAdminUsers } from '@/lib/server/admin-users'
import type { RequestViewer } from '@/lib/server/viewer'
import { adminUserQueryKey, adminUsersQueryKey } from './users-query'

/**
 * Reads one page of the user list in the request's query client and settles when the read has, so the
 * table is in the HTML the server sends. The server bounds the read at two seconds. It never rejects:
 * a failed read is logged and left out of the state the page hands to the browser, which reads it again.
 */
export function prefetchAdminUsersAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  search: string,
  page: number
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: adminUsersQueryKey(search, page),
    queryFn: async () => {
      try {
        return await loadAdminUsers(viewer, search, page)
      } catch (error) {
        console.error('Users read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}

/** The same for one user's page. */
export function prefetchAdminUserAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  id: string
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: adminUserQueryKey(id),
    queryFn: async () => {
      try {
        return await loadAdminUser(viewer, id)
      } catch (error) {
        console.error('User read failed; the browser reads it instead:', error)
        throw error
      }
    },
    retry: false,
  })
}
