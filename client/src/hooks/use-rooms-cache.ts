import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { PublicRoom, RoomsResponse } from '@/types'

interface UseRoomsCacheReturn {
  addRoom: (room: PublicRoom) => void
  updateRoom: (roomId: string, updates: Partial<PublicRoom>) => void
  removeRoom: (roomId: string) => void
}

export function useRoomsCache(): UseRoomsCacheReturn {
  const queryClient = useQueryClient()

  const addRoom = useCallback(
    (room: PublicRoom) => {
      queryClient.setQueryData<RoomsResponse>(['rooms'], (old) => {
        if (!old) return { rooms: [room] }
        // Avoid duplicates
        if (old.rooms.some((r) => r.id === room.id)) return old
        return { rooms: [...old.rooms, room] }
      })
    },
    [queryClient]
  )

  const updateRoom = useCallback(
    (roomId: string, updates: Partial<PublicRoom>) => {
      queryClient.setQueryData<RoomsResponse>(['rooms'], (old) => {
        if (!old) return { rooms: [] }
        return {
          rooms: old.rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
        }
      })
    },
    [queryClient]
  )

  const removeRoom = useCallback(
    (roomId: string) => {
      queryClient.setQueryData<RoomsResponse>(['rooms'], (old) => {
        if (!old) return { rooms: [] }
        return { rooms: old.rooms.filter((r) => r.id !== roomId) }
      })
    },
    [queryClient]
  )

  return { addRoom, updateRoom, removeRoom }
}
