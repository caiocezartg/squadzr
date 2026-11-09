import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { AdminGamesPage, adminGamesParamsFrom } from '@/features/admin/page'
import { prefetchAdminGamesAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireFullAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer who is not an admin or the
// owner (a moderator included) gets the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Catalog' }, 'full')
}

interface AdminCatalogGamesRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The Catalog page's Games tab, for an admin or the owner: a moderator passes the layout's gate and is
 * stopped here with not-found, before the read is sent. The page of games the URL asks for
 * (`?q=&status=&sort=&page=`) and the tab's summary are read on the server and waited for, so a hard
 * load has them in its HTML and needs no skeleton; a read that fails or takes over two seconds is left
 * to the browser. Later searches, filters and pages happen in the browser, without a server render.
 */
export default async function AdminCatalogGamesRoute({
  searchParams,
}: AdminCatalogGamesRouteProps) {
  await requireFullAdminSession()
  const params = adminGamesParamsFrom(await searchParams)
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAdminGamesAndWait(queryClient, viewer, params)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminGamesPage />
    </HydrationBoundary>
  )
}
