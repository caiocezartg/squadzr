import 'server-only'
import {
  activityResponseSchema,
  overviewResponseSchema,
  type ActivityMetric,
  type ActivityResponse,
  type OverviewPeriod,
  type OverviewResponse,
} from '@squadzr/schemas'
import { serverApi } from './api'
import type { RequestViewer } from './viewer'

// A slow Fastify holds the page for at most this long; the browser then reads the data itself.
const ADMIN_OVERVIEW_TIMEOUT_MS = 2_000

const VIEWER_READ = { credentials: 'viewer', caching: 'uncached' } as const

/**
 * The Overview as the viewer may read it (a moderator gets no recent audit). The response is that
 * viewer's data, so it is read per request and never cached. Any failure throws.
 */
export function loadAdminOverview(
  viewer: RequestViewer,
  period: OverviewPeriod
): Promise<OverviewResponse> {
  return serverApi.get(
    `/api/admin/overview?period=${period}`,
    overviewResponseSchema,
    { ...VIEWER_READ, cookie: viewer.cookie },
    { timeoutMs: ADMIN_OVERVIEW_TIMEOUT_MS }
  )
}

/** One metric's per-day series of the Activity chart. Any failure throws. */
export function loadAdminActivity(
  viewer: RequestViewer,
  metric: ActivityMetric,
  period: OverviewPeriod
): Promise<ActivityResponse> {
  return serverApi.get(
    `/api/admin/activity?metric=${metric}&period=${period}`,
    activityResponseSchema,
    { ...VIEWER_READ, cookie: viewer.cookie },
    { timeoutMs: ADMIN_OVERVIEW_TIMEOUT_MS }
  )
}
