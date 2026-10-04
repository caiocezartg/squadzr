import { createFileRoute } from '@tanstack/react-router'
import { LobbyPage } from '@/features/lobby'

export const Route = createFileRoute('/rooms/$code')({
  component: LobbyRoute,
})

/**
 * Thin entry point: the lobby capability owns data, realtime, Presence,
 * commands and local state behind `LobbyPage`.
 */
function LobbyRoute() {
  const { code } = Route.useParams()
  return <LobbyPage roomCode={code} />
}
