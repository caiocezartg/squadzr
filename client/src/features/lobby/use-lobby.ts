import { useCallback, useMemo } from 'react'
import { isRoomLobbyResponse } from '@squadzr/schemas'
import { useSquadBoardCommands } from '@/features/squad-board'
import { useSession } from '@/hooks/use-session'
import { useAppNavigation } from '@/lib/navigation'
import type { RealtimeStatus } from '@/lib/ws-client'
import type { Player, PublicSquad } from '@/types'
import { rosterFromSnapshot, type PresenceState } from './squad-snapshot'
import { useSquadChannel, type SquadChannel } from './use-squad-channel'
import { useSquadData } from './use-squad-data'
import { useSquadMembership } from './use-squad-membership'

export interface LobbyView {
  /** The Squad is not there for this viewer (missing, expired or Ready to a non-member). */
  squadMissing: boolean
  membershipRevoked: boolean
  squad: PublicSquad | null
  /** The game summary the rendered Squad carries, before and after a realtime snapshot. */
  game: PublicSquad['game'] | null
  players: Player[]
  maxPlayers: number
  presence: PresenceState
  discordLink: string | null
  isReady: boolean
  connectionStatus: RealtimeStatus
  /** The code of the latest realtime error, translated by the page; null when none shows. */
  errorCode: string | null
  dismissError: () => void
  leaveSquad: () => Promise<void>
}

/**
 * The Lobby's realtime side, held by the page above the Squad's read: the socket, the squad channel and the
 * snapshot. The channel joins while the read is still pending, so the snapshot is never held back by HTTP.
 * Only a signed-in viewer joins the squad channel.
 */
export function useLobbyChannel(squadCode: string): SquadChannel {
  const session = useSession()
  const navigateApp = useAppNavigation()
  const board = useSquadBoardCommands()
  const userId = session?.user?.id

  const handleSquadRemoved = useCallback(
    (squadId: string) => {
      board.removeSquad(squadId)
      navigateApp('/squads')
    },
    [board, navigateApp]
  )

  return useSquadChannel({ squadCode, enabled: !!userId, onSquadRemoved: handleSquadRemoved })
}

/**
 * The Lobby's view model: the Squad's details (read with suspense), the channel the page holds, and the
 * Membership workflow. It derives everything the Lobby renders.
 */
export function useLobbyView(squadCode: string, channel: SquadChannel): LobbyView {
  const session = useSession()
  const board = useSquadBoardCommands()
  const details = useSquadData(squadCode)
  const userId = session?.user?.id

  // The snapshot is the live source of Squad metadata; HTTP only supplies it before the first snapshot
  // arrives. Both carry the game summary, so the game survives the snapshot replacing the Squad.
  const squad = channel.snapshot?.room ?? details?.room ?? null
  const lobbyDetails = details && isRoomLobbyResponse(details) ? details : null

  const { leaveSquad } = useSquadMembership({
    squadCode,
    squad,
    userId,
    board,
    notifySquadLeave: channel.notifySquadLeave,
  })

  // Roster, Presence and readiness come from the snapshot alone. Until it arrives they stay empty, so the
  // slots show as placeholders and nobody reads as online or ready.
  const players = useMemo(
    () => (channel.snapshot ? rosterFromSnapshot(channel.snapshot) : []),
    [channel.snapshot]
  )
  const maxPlayers = squad?.maxPlayers ?? 5
  const discordLink = channel.snapshot?.room.discordLink ?? lobbyDetails?.room.discordLink ?? null

  return {
    squadMissing: details === null,
    membershipRevoked: channel.membershipRevoked,
    squad,
    game: squad?.game ?? null,
    players,
    maxPlayers,
    presence: channel.presence,
    discordLink,
    isReady: channel.snapshot?.readyAt != null,
    connectionStatus: channel.status,
    errorCode: channel.errorCode,
    dismissError: channel.dismissError,
    leaveSquad,
  }
}
