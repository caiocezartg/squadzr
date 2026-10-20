import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { SquadBoardPage, prefetchSquadBoard } from '@/features/squad-board/page'
import { prefetchRoute } from '@/lib/query-client'
import { getRequestViewer } from '@/lib/server/viewer'

// The root layout's title template adds the app name.
export const metadata: Metadata = {
  title: 'Squads',
}

/**
 * The Squad Board. The viewer's squads and the games are read on the server and handed to the browser
 * through the query client. The page does not wait for those reads: a read still running reaches the
 * browser as a pending query, so a client navigation renders the squads the cache holds at once, and
 * the board suspends only where it has no data.
 */
export default async function SquadsPage() {
  const viewer = await getRequestViewer()
  // The prefetch returns nothing, so `prefetchRoute` does not wait for the reads.
  const state = await prefetchRoute((queryClient) => prefetchSquadBoard(queryClient, viewer))

  return (
    <HydrationBoundary state={state}>
      <SquadBoardPage />
    </HydrationBoundary>
  )
}
