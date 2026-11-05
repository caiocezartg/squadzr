import 'server-only'
import { auditEntriesResponseSchema, type AuditEntriesResponse } from '@squadzr/schemas'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the page itself.
const AUDIT_TIMEOUT_MS = 2_000

/**
 * One page of the audit, newest first, as the admin who sent the request may read it. The response is
 * that admin's data, so it is read per request and never cached. Any failure throws.
 */
export function loadAuditEntries(
  viewer: RequestViewer,
  page: number
): Promise<AuditEntriesResponse> {
  return serverApi.get(
    `/api/admin/audit?page=${page}`,
    auditEntriesResponseSchema,
    { credentials: 'viewer', caching: 'uncached', cookie: viewer.cookie },
    { timeoutMs: AUDIT_TIMEOUT_MS }
  )
}
