import { useCallback, useMemo } from 'react'
import { useSquadBoardCommands } from '@/features/squad-board'
import { useSession } from '@/hooks/use-session'
import { useAppNavigation } from '@/lib/navigation'
import type { RealtimeStatus } from '@/lib/ws-client'
import type { Game, Player, PublicSquad } from '@/types'
import { rosterFromSnapshot, type PresenceState } from './room-snapshot'
import { useRoomChannel } from './use-room-channel'
import { useRoomData } from './use-room-data'
import { useRoomMembership } from './use-room-membership'

export interface LobbyRoomView {
  isAuthenticated: boolean
  roomLoading: boolean
  roomNotFound: boolean
  membershipRevoked: boolean
  room: PublicSquad | null
  game: Game | null
  players: Player[]
  maxPlayers: number
  emptySlots: number
  presence: PresenceState
  discordLink: string | null
  isReadyRoom: boolean
  connectionStatus: RealtimeStatus
  /** The code of the latest realtime error, translated by the page; null when none shows. */
  errorCode: string | null
  dismissError: () => void
  leaveRoom: () => Promise<void>
}

/**
 * The lobby's view model: composes the HTTP room data, the realtime room
 * channel and the Membership workflow, and derives everything the page
 * renders. The route only supplies the room code.
 */
export function useLobbyRoom(roomCode: string): LobbyRoomView {
  const session = useSession()
  const navigateApp = useAppNavigation()
  const board = useSquadBoardCommands()
  const roomData = useRoomData(roomCode)
  const userId = session?.user?.id

  const handleRoomRemoved = useCallback(
    (roomId: string) => {
      board.removeSquad(roomId)
      navigateApp('/squads')
    },
    [board, navigateApp]
  )

  const channel = useRoomChannel({
    roomCode,
    enabled: !!userId,
    onRoomRemoved: handleRoomRemoved,
  })

  // The snapshot is the live source of room metadata; HTTP only supplies it
  // before the first snapshot arrives.
  const room = channel.snapshot?.room ?? roomData.room

  const { leaveRoom } = useRoomMembership({
    roomCode,
    room,
    userId,
    board,
    notifyRoomLeave: channel.notifyRoomLeave,
  })

  const players = useMemo(
    () => (channel.snapshot ? rosterFromSnapshot(channel.snapshot) : []),
    [channel.snapshot]
  )
  const maxPlayers = channel.snapshot?.room.maxPlayers ?? roomData.room?.maxPlayers ?? 5
  const discordLink = channel.snapshot?.room.discordLink ?? roomData.lobby?.room.discordLink ?? null
  const isReadyRoom = channel.snapshot?.readyAt != null

  return {
    isAuthenticated: !!session?.user,
    roomLoading: roomData.isLoading,
    roomNotFound: roomData.hasError,
    membershipRevoked: channel.membershipRevoked,
    room,
    game: roomData.game,
    players,
    maxPlayers,
    emptySlots: Math.max(0, maxPlayers - players.length),
    presence: channel.presence,
    discordLink,
    isReadyRoom,
    connectionStatus: channel.status,
    errorCode: channel.errorCode,
    dismissError: channel.dismissError,
    leaveRoom,
  }
}
