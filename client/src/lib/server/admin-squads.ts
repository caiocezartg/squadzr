import 'server-only'
import { adminSquadsResponseSchema, type AdminSquadsResponse } from '@squadzr/schemas'
import { adminSquadsPath, type AdminSquadsParams } from '@/lib/admin-squads-path'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the data itself.
const ADMIN_SQUADS_TIMEOUT_MS = 2_000

/**
 * One page of the Open Squads as the panel viewer who sent the request may read it. The response is that
 * viewer's data, so it is read per request and never cached. Any failure throws.
 */
export function loadAdminSquads(
  viewer: RequestViewer,
  params: AdminSquadsParams
): Promise<AdminSquadsResponse> {
  return serverApi.get(
    adminSquadsPath(params),
    adminSquadsResponseSchema,
    { credentials: 'viewer', caching: 'uncached', cookie: viewer.cookie },
    { timeoutMs: ADMIN_SQUADS_TIMEOUT_MS }
  )
}
