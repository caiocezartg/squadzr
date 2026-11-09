import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { AdminCatalogPage, catalogPageFrom } from '@/features/admin/page'
import { prefetchCatalogImportRunsAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireFullAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer who is not an admin or the
// owner (a moderator included) gets the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Catalog' }, 'full')
}

interface AdminCatalogRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The Catalog page. Catalog Import is for an admin or the owner: a moderator passes the layout's gate
 * and is stopped here with not-found, before the read is sent. The page of the run history the URL asks
 * for (`?page=`, the first when absent or invalid) is read on the server and waited for, so a hard load
 * has the table in its HTML and needs no skeleton; a read that fails or takes over two seconds is left
 * to the browser. Later moves between pages happen in the browser, without a server render.
 */
export default async function AdminCatalogRoute({ searchParams }: AdminCatalogRouteProps) {
  await requireFullAdminSession()
  const page = catalogPageFrom((await searchParams).page)
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchCatalogImportRunsAndWait(queryClient, viewer, page)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminCatalogPage />
    </HydrationBoundary>
  )
}
