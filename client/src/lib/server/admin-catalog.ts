import 'server-only'
import { catalogImportRunsResponseSchema, type CatalogImportRunsResponse } from '@squadzr/schemas'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the page itself.
const CATALOG_RUNS_TIMEOUT_MS = 2_000

/**
 * One page of the Catalog Import Run history, newest first, as the admin who sent the request may read
 * it. The response is that admin's data, so it is read per request and never cached. Any failure throws.
 */
export function loadCatalogImportRuns(
  viewer: RequestViewer,
  page: number
): Promise<CatalogImportRunsResponse> {
  return serverApi.get(
    `/api/admin/catalog-import/runs?page=${page}`,
    catalogImportRunsResponseSchema,
    { credentials: 'viewer', caching: 'uncached', cookie: viewer.cookie },
    { timeoutMs: CATALOG_RUNS_TIMEOUT_MS }
  )
}
