import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { HydrationBoundary } from '@tanstack/react-query'
import { MySquadsPage, prefetchMySquads } from '@/features/my-squads/page'
import { prefetchRoute } from '@/lib/query-client'
import { getRequestSession } from '@/lib/server/session'
import { getRequestViewer } from '@/lib/server/viewer'

// The root layout's title template adds the app name.
export const metadata: Metadata = {
  title: 'My squads',
}

/**
 * My Squads. The request's session decides whether the viewer may see the page: a signed-out
 * viewer is redirected to the landing before any content renders. The session read is the one the
 * root layout already made, so it costs no extra request. The list and the games are then started
 * on the server and handed to the browser through the query client; the page does not wait for
 * those reads, so a client navigation renders the lists the cache holds at once, and the page
 * suspends only where it has no data.
 */
export default async function MySquadsRoute() {
  const session = await getRequestSession()
  if (!session) redirect('/')

  const viewer = await getRequestViewer()
  // The prefetch returns nothing, so `prefetchRoute` does not wait for the reads.
  const state = await prefetchRoute((queryClient) => prefetchMySquads(queryClient, viewer))

  return (
    <HydrationBoundary state={state}>
      <MySquadsPage />
    </HydrationBoundary>
  )
}
