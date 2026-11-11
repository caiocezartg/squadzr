import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { AdminUsersPage, adminUsersParamsFrom } from '@/features/admin/page'
import { prefetchAdminUsersAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer without a panel role gets
// the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Users' })
}

interface AdminUsersRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The Users page. The search and page the URL asks for (`?q=&page=`) are read on the server and waited
 * for, so a hard load has the table in its HTML and needs no skeleton; a read that fails or takes over
 * two seconds is left to the browser. The page renders beside the layout, not after it, so it passes
 * the gate itself before reading: a visitor without a panel role never sends the read.
 */
export default async function AdminUsersRoute({ searchParams }: AdminUsersRouteProps) {
  await requireAdminSession()
  const { search, page } = adminUsersParamsFrom(await searchParams)
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAdminUsersAndWait(queryClient, viewer, search, page)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminUsersPage />
    </HydrationBoundary>
  )
}
