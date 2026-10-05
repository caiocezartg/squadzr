import { useCallback, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useCatalogCommands } from '@/features/catalog/commands'
import { useSession } from '@/lib/auth-client'
import type { RealtimeStatus } from '@/lib/ws-client'
import type { Game, Player, PublicRoom } from '@/types'
import { rosterFromSnapshot, type PresenceState } from './room-snapshot'
import { useRoomChannel } from './use-room-channel'
import { useRoomData } from './use-room-data'
import { useRoomMembership } from './use-room-membership'

export interface LobbyRoomView {
  sessionPending: boolean
  isAuthenticated: boolean
  roomLoading: boolean
  roomNotFound: boolean
  membershipRevoked: boolean
  room: PublicRoom | null
  game: Game | null
  players: Player[]
  maxPlayers: number
  emptySlots: number
  presence: PresenceState
  discordLink: string | null
  isReadyRoom: boolean
  connectionStatus: RealtimeStatus
  error: string | null
  dismissError: () => void
  leaveRoom: () => Promise<void>
}

/**
 * The lobby's view model: composes the HTTP room data, the realtime room
 * channel and the Membership workflow, and derives everything the page
 * renders. The route only supplies the room code.
 */
export function useLobbyRoom(roomCode: string): LobbyRoomView {
  const { data: session, isPending: sessionPending } = useSession()
  const navigate = useNavigate()
  const catalog = useCatalogCommands()
  const roomData = useRoomData(roomCode)
  const userId = session?.user?.id

  const handleRoomRemoved = useCallback(
    (roomId: string) => {
      catalog.removeRoom(roomId)
      void navigate({ to: '/rooms', search: {} })
    },
    [catalog, navigate]
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
    catalog,
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
    sessionPending,
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
    error: channel.error,
    dismissError: channel.dismissError,
    leaveRoom,
  }
}
