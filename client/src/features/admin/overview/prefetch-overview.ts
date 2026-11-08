import 'server-only'
import type { QueryClient } from '@tanstack/react-query'
import { ACTIVITY_METRICS, type OverviewPeriod } from '@squadzr/schemas'
import { loadAdminActivity, loadAdminOverview } from '@/lib/server/admin-overview'
import type { RequestViewer } from '@/lib/server/viewer'
import { activityQueryKey, overviewQueryKey } from './overview-query'

/**
 * Reads the Overview of one period and every metric's Activity series in the request's query client,
 * and settles when the reads have, so the tiles and the chart are in the HTML the server sends. The
 * server bounds each read at two seconds. It never rejects: a failed read is logged and left out of the
 * state the page hands to the browser, which reads it again.
 */
export async function prefetchAdminOverviewAndWait(
  queryClient: QueryClient,
  viewer: RequestViewer,
  period: OverviewPeriod
): Promise<void> {
  const logFailure = async <T>(label: string, read: () => Promise<T>): Promise<T> => {
    try {
      return await read()
    } catch (error) {
      console.error(`${label} read failed; the browser reads it instead:`, error)
      throw error
    }
  }

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: overviewQueryKey(period),
      queryFn: () => logFailure('Overview', () => loadAdminOverview(viewer, period)),
      retry: false,
    }),
    ...ACTIVITY_METRICS.map((metric) =>
      queryClient.prefetchQuery({
        queryKey: activityQueryKey(metric, period),
        queryFn: () => logFailure('Activity', () => loadAdminActivity(viewer, metric, period)),
        retry: false,
      })
    ),
  ])
}
