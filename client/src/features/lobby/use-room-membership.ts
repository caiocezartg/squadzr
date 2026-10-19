import { useCallback } from 'react'
import { useTranslations } from 'next-intl'
import type { SquadBoardCommands } from '@/features/squad-board'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { useAppNavigation } from '@/lib/navigation'
import { notifyError } from '@/lib/notify'
import type { PublicSquad } from '@/types'

interface UseRoomMembershipOptions {
  roomCode: string
  /** Metadata of the room whose Membership is being left. */
  room: PublicSquad | null
  userId: string | undefined
  board: SquadBoardCommands
  /** Releases this tab's channel for the room. */
  notifyRoomLeave: (roomCode: string) => void
}

/**
 * The Membership workflow of leaving the room: release the realtime channel,
 * end the durable Membership over HTTP, drop a hosted room from the board
 * and return to the board. Leaving the route instead only changes Presence,
 * because it never runs this workflow.
 */
export function useRoomMembership({
  roomCode,
  room,
  userId,
  board,
  notifyRoomLeave,
}: UseRoomMembershipOptions) {
  const navigateApp = useAppNavigation()
  const t = useTranslations()

  const leaveRoom = useCallback(async () => {
    try {
      const isHost = room?.hostId === userId
      notifyRoomLeave(roomCode)
      await api.post(`/api/rooms/${encodeURIComponent(roomCode)}/leave`, {})
      if (isHost && room) {
        board.removeSquad(room.id)
      }
      await board.refreshSquads()
      navigateApp('/squads')
    } catch (err) {
      notifyError(getUserFriendlyError(err, t, 'leave'))
    }
  }, [room, userId, roomCode, notifyRoomLeave, board, navigateApp, t])

  return { leaveRoom }
}
