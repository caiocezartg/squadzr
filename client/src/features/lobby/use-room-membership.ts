import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { CatalogCommands } from '@/features/catalog'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import type { PublicRoom } from '@/types'

interface UseRoomMembershipOptions {
  roomCode: string
  /** Metadata of the room whose Membership is being left. */
  room: PublicRoom | null
  userId: string | undefined
  catalog: CatalogCommands
  /** Releases this tab's channel for the room. */
  notifyRoomLeave: (roomCode: string) => void
}

/**
 * The Membership workflow of leaving the room: release the realtime channel,
 * end the durable Membership over HTTP, drop a hosted room from the catalog
 * and return to the catalog. Leaving the route instead only changes Presence,
 * because it never runs this workflow.
 */
export function useRoomMembership({
  roomCode,
  room,
  userId,
  catalog,
  notifyRoomLeave,
}: UseRoomMembershipOptions) {
  const navigate = useNavigate()

  const leaveRoom = useCallback(async () => {
    try {
      const isHost = room?.hostId === userId
      notifyRoomLeave(roomCode)
      await api.post(`/api/rooms/${roomCode}/leave`, {})
      if (isHost && room) {
        catalog.removeRoom(room.id)
      }
      await catalog.refreshRooms()
      await navigate({ to: '/rooms', search: {} })
    } catch (err) {
      toast.error(getUserFriendlyError(err))
    }
  }, [room, userId, roomCode, notifyRoomLeave, catalog, navigate])

  return { leaveRoom }
}
