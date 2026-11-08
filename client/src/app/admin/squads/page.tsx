import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { AdminSquadsPage, adminSquadsParamsFrom } from '@/features/admin/page'
import { prefetchAdminSquadsAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer without a panel role gets
// the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Squads' })
}

interface AdminSquadsRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The Squads page. The search, game and page the URL asks for (`?q=&gameId=&page=`) are read on the
 * server and waited for, so a hard load has the table in its HTML and needs no skeleton; a read that
 * fails or takes over two seconds is left to the browser. A moderator, an admin and the owner may open
 * it; the page passes the gate itself because it renders beside the layout, not after it.
 */
export default async function AdminSquadsRoute({ searchParams }: AdminSquadsRouteProps) {
  await requireAdminSession()
  const { search, gameId, page } = adminSquadsParamsFrom(await searchParams)
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAdminSquadsAndWait(queryClient, viewer, search, gameId, page)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminSquadsPage />
    </HydrationBoundary>
  )
}
