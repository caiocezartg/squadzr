import { createFileRoute } from '@tanstack/react-router'
import { LobbyPage } from '@/features/lobby'
import { LobbySkeleton } from '@/features/lobby/skeleton'

export const Route = createFileRoute('/rooms/$code')({
  component: LobbyRoute,
  // The same skeleton covers the route chunk and the data load.
  pendingComponent: LobbySkeleton,
})

/**
 * Thin entry point: the lobby capability owns data, realtime, Presence,
 * commands and local state behind `LobbyPage`.
 */
function LobbyRoute() {
  const { code } = Route.useParams()
  return <LobbyPage roomCode={code} />
}
