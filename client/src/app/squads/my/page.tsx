import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { HydrationBoundary } from '@tanstack/react-query'
import { MySquadsPage, prefetchMySquads } from '@/features/my-squads/page'
import { prefetchRoute } from '@/lib/query-client'
import { hasSessionCookie } from '@/lib/server/session-cookie'
import { getRequestViewer } from '@/lib/server/viewer'

// The root layout's title template adds the app name.
export const metadata: Metadata = {
  title: 'My squads',
}

/**
 * My Squads. A request with no session cookie is redirected to the landing before any content
 * renders. The check reads the cookie and never calls the API, so a navigation does not wait on the
 * server. A cookie that is present but expired is not caught here: the list's read answers 401, and
 * the browser sends the viewer to the landing (see `useSignedOutRedirect`). The list and the games
 * are started on the server and handed to the browser through the query client; the page does not
 * wait for those reads, so a client navigation renders the lists the cache holds at once, and the
 * page suspends only where it has no data.
 */
export default async function MySquadsRoute() {
  const viewer = await getRequestViewer()
  if (!hasSessionCookie(viewer.cookie)) redirect('/')

  // The prefetch returns nothing, so `prefetchRoute` does not wait for the reads.
  const state = await prefetchRoute((queryClient) => prefetchMySquads(queryClient, viewer))

  return (
    <HydrationBoundary state={state}>
      <MySquadsPage />
    </HydrationBoundary>
  )
}
