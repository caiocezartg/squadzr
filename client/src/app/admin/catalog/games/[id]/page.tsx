import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HydrationBoundary } from '@tanstack/react-query'
import { adminGameIdParamSchema } from '@squadzr/schemas'
import { AdminGamePage } from '@/features/admin/page'
import { prefetchAdminGameAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireFullAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer who is not an admin or the
// owner (a moderator included) gets the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Game' }, 'full')
}

interface AdminCatalogGameRouteProps {
  readonly params: Promise<{ id: string }>
}

/**
 * One game's page in the Catalog, for an admin or the owner. An id that is not a game id is not found
 * before any read; otherwise the game is read on the server and waited for, so a hard load has the page
 * in its HTML. The page passes the gate itself before reading, because it renders beside the layout.
 */
export default async function AdminCatalogGameRoute({ params }: AdminCatalogGameRouteProps) {
  await requireFullAdminSession()
  const { id } = await params
  if (!adminGameIdParamSchema.safeParse({ id }).success) notFound()
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAdminGameAndWait(queryClient, viewer, id)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminGamePage id={id} />
    </HydrationBoundary>
  )
}
