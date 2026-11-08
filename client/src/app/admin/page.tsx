import { HydrationBoundary } from '@tanstack/react-query'
import { AdminOverviewPage, overviewPeriodFrom } from '@/features/admin/page'
import { prefetchAdminOverviewAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireAdminSession } from '@/lib/server/admin-gate'
import { getRequestViewer } from '@/lib/server/viewer'

interface AdminOverviewRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The panel's overview. Its title is the layout's default. The period the URL asks for (`?period=`, 30
 * days when absent or invalid) is read on the server and waited for, so a hard load has the numbers and
 * the chart in its HTML and needs no skeleton; a read that fails or takes over two seconds is left to
 * the browser. The page renders beside the layout, not after it, so it passes the gate itself before
 * reading: a visitor without a panel role never sends the reads.
 */
export default async function AdminOverviewRoute({ searchParams }: AdminOverviewRouteProps) {
  await requireAdminSession()
  const period = overviewPeriodFrom((await searchParams).period)
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAdminOverviewAndWait(queryClient, viewer, period)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminOverviewPage />
    </HydrationBoundary>
  )
}
