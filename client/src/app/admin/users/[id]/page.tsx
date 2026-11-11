import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { AdminUserPage } from '@/features/admin/page'
import { prefetchAdminUserAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer without a panel role gets
// the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'User' })
}

interface AdminUserRouteProps {
  readonly params: Promise<{ id: string }>
}

/**
 * One user's page. Its data is read on the server and waited for, so a hard load has the page in its
 * HTML; the page passes the gate itself before reading, because it renders beside the layout.
 */
export default async function AdminUserRoute({ params }: AdminUserRouteProps) {
  await requireAdminSession()
  const { id } = await params
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAdminUserAndWait(queryClient, viewer, id)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminUserPage id={id} />
    </HydrationBoundary>
  )
}
