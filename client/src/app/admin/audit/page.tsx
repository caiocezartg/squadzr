import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { AdminAuditPage, auditPageFrom } from '@/features/admin/page'
import { prefetchAuditEntriesAndWait } from '@/features/admin/server'
import { prefetchRoute } from '@/lib/query-client'
import { requireFullAdminSession } from '@/lib/server/admin-gate'
import { adminMetadata } from '@/lib/server/admin-metadata'
import { getRequestViewer } from '@/lib/server/viewer'

// The admin layout's title template adds the panel and app names; a viewer who is not an admin or the
// owner (a moderator included) gets the not-found head instead.
export function generateMetadata(): Promise<Metadata> {
  return adminMetadata({ title: 'Audit' }, 'full')
}

interface AdminAuditRouteProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * The Audit page. The page the URL asks for (`?page=`, the first when absent or invalid) is read on the
 * server and waited for, so a hard load has the table in its HTML and needs no skeleton; a read that
 * fails or takes over two seconds is left to the browser. Later moves between pages happen in the
 * browser, without a server render. The page renders beside the layout, not after it, so it passes the
 * gate itself before reading: a visitor who is not an admin or the owner never sends the read. The session read is
 * cached per request, so this adds no request.
 */
export default async function AdminAuditRoute({ searchParams }: AdminAuditRouteProps) {
  await requireFullAdminSession()
  const page = auditPageFrom((await searchParams).page)
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) =>
    prefetchAuditEntriesAndWait(queryClient, viewer, page)
  )

  return (
    <HydrationBoundary state={state}>
      <AdminAuditPage />
    </HydrationBoundary>
  )
}
