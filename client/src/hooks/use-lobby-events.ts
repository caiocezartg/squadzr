import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRoomsCache } from './use-rooms-cache'
import type { RealtimeChannelHandlers, RealtimeSubscription } from '@/lib/ws-client'

interface UseLobbyEventsOptions {
  subscribe: (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers) => () => void
}

/**
 * Keeps the catalog cache in sync with the lobby stream. The transport owns
 * resubscription, so the handlers are registered once and replay after every
 * reconnect. Incremental hints are idempotent, so duplicate events are
 * harmless; a restored subscription (reconnect) also refetches the catalog so
 * events missed while the socket was down cannot leave stale cards behind.
 */
export function useLobbyEvents({ subscribe }: UseLobbyEventsOptions): void {
  const { addRoom, updateRoom, removeRoom } = useRoomsCache()
  const queryClient = useQueryClient()
  const hasSubscribedRef = useRef(false)

  useEffect(() => {
    return subscribe(
      { type: 'subscribe_lobby' },
      {
        lobby_subscribed: () => {
          if (!hasSubscribedRef.current) {
            hasSubscribedRef.current = true
            return
          }
          void queryClient.invalidateQueries({ queryKey: ['rooms'] })
        },
        room_created: (payload) => {
          addRoom(payload.room)
        },
        room_updated: (payload) => {
          updateRoom(payload.roomId, { memberCount: payload.memberCount })
        },
        room_removed: (payload) => {
          removeRoom(payload.roomId)
        },
      }
    )
  }, [subscribe, addRoom, updateRoom, removeRoom, queryClient])
}
