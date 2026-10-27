import type { ReactNode } from 'react'
import { HydrationBoundary } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/app-shell'
import { prefetchMySquadsAndWait } from '@/features/my-squads/server'
import { prefetchSquadBoardAndWait } from '@/features/squad-board/server'
import { prefetchRoute } from '@/lib/query-client'
import { hasSessionCookie } from '@/lib/server/session-cookie'
import { getRequestViewer } from '@/lib/server/viewer'

/**
 * The layout of the app pages: the Squad Board and the Lobby, inside the sidebar shell. The sidebar
 * shows two reads, so the layout starts both on the server and hands them to the browser through the
 * query client: the board's list for the "All squads" count, and, for a signed-in viewer, their squads
 * for "My squads". The layout waits for them, which the server bounds at two seconds each, because a
 * count or a list that arrives after the HTML is not in it; a read that fails or times out is left to
 * the browser. The page's own prefetch then finds the board's list cached. The layout stays mounted
 * while the viewer moves between the pages, so it renders on the server once per full load. The board
 * read runs for a visitor too, since the board is public; the viewer's squads are read only when the
 * request carries a session cookie, so a visitor's page does not wait on a read that would answer 401.
 */
export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const viewer = await getRequestViewer()
  const signedIn = hasSessionCookie(viewer.cookie)
  const state = await prefetchRoute((queryClient) =>
    Promise.all([
      prefetchSquadBoardAndWait(queryClient, viewer),
      signedIn ? prefetchMySquadsAndWait(queryClient, viewer) : undefined,
    ])
  )

  return (
    <HydrationBoundary state={state}>
      <AppShell>{children}</AppShell>
    </HydrationBoundary>
  )
}
