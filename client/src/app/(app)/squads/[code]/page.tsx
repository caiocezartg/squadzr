import type { Metadata } from 'next'
import { HydrationBoundary } from '@tanstack/react-query'
import { LobbyPage, lobbyMetadata, prefetchLobby } from '@/features/lobby/page'
import { prefetchRoute } from '@/lib/query-client'
import { getRequestViewer } from '@/lib/server/viewer'

interface LobbyRouteProps {
  readonly params: Promise<{ code: string }>
}

/** The invite preview of the Squad: its name and game, or the generic metadata when there is no Squad to show. */
export async function generateMetadata({ params }: LobbyRouteProps): Promise<Metadata> {
  const { code } = await params
  return lobbyMetadata(code)
}

/**
 * The Lobby. The Squad is read on the server for the viewer and handed to the browser through the query
 * client. The page does not wait for that read, so the navigation does not either: a read still running
 * reaches the browser as a pending query, and the Lobby suspends on it only where it has no data.
 */
export default async function LobbyRoute({ params }: LobbyRouteProps) {
  const { code } = await params
  const viewer = await getRequestViewer()
  const state = await prefetchRoute((queryClient) => prefetchLobby(queryClient, viewer, code))

  return (
    <HydrationBoundary state={state}>
      <LobbyPage squadCode={code} />
    </HydrationBoundary>
  )
}
