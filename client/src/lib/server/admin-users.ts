import 'server-only'
import {
  adminUserResponseSchema,
  adminUsersResponseSchema,
  type AdminUserResponse,
  type AdminUsersResponse,
} from '@squadzr/schemas'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the data itself.
const ADMIN_USERS_TIMEOUT_MS = 2_000

/**
 * One page of the users as the admin who sent the request may read it. The response is that admin's
 * data, so it is read per request and never cached. Any failure throws.
 */
export function loadAdminUsers(
  viewer: RequestViewer,
  search: string,
  page: number
): Promise<AdminUsersResponse> {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('q', search)
  return serverApi.get(
    `/api/admin/users?${params.toString()}`,
    adminUsersResponseSchema,
    { credentials: 'viewer', caching: 'uncached', cookie: viewer.cookie },
    { timeoutMs: ADMIN_USERS_TIMEOUT_MS }
  )
}

/** One user's page, read the same way. */
export function loadAdminUser(viewer: RequestViewer, id: string): Promise<AdminUserResponse> {
  return serverApi.get(
    `/api/admin/users/${encodeURIComponent(id)}`,
    adminUserResponseSchema,
    { credentials: 'viewer', caching: 'uncached', cookie: viewer.cookie },
    { timeoutMs: ADMIN_USERS_TIMEOUT_MS }
  )
}
