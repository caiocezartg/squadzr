import type { ReactNode } from 'react'
import { HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { prefetchSquadBoardAndWait } from '@/features/squad-board/server'
import { prefetchRoute } from '@/lib/query-client'
import { hasSessionCookie } from '@/lib/server/session-cookie'
import { getRequestViewer } from '@/lib/server/viewer'

/**
 * The layout of the app pages: the Squad Board, the Lobby and My Squads, inside the sidebar shell. The
 * sidebar's "All squads" count reads the board's list, so the layout starts that read on the server
 * and hands it to the browser through the query client, and the count is in the HTML the server sends.
 * The layout waits for the read, which the server bounds at two seconds, because a count that arrives
 * after the HTML is not in it. The page's own prefetch then finds the list cached. The layout stays
 * mounted while the viewer moves between the pages, so it renders on the server once per full load.
 * A request with no session cookie skips the read, so My Squads' redirect for a visitor is not
 * delayed by it; the count then comes from the page's own read.
 */
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await getRequestViewer()
  const state = hasSessionCookie(viewer.cookie)
    ? await prefetchRoute((queryClient) => prefetchSquadBoardAndWait(queryClient, viewer))
    : undefined

  return (
    <HydrationBoundary state={state}>
      <AppShell>{children}</AppShell>
    </HydrationBoundary>
  )
}
