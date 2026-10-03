import { useState, useEffect } from 'react'
import { useRoomsCache } from './use-rooms-cache'
import { onServerEvent } from '@/lib/ws-validators'
import type { WebSocketEventHandler } from '@/lib/ws-client'

interface UseLobbyEventsOptions {
  isConnected: boolean
  send: (type: string, data: unknown) => void
  on: (event: string, handler: WebSocketEventHandler) => () => void
}

interface UseLobbyEventsReturn {
  isSubscribed: boolean
}

export function useLobbyEvents({
  isConnected,
  send,
  on,
}: UseLobbyEventsOptions): UseLobbyEventsReturn {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const { addRoom, updateRoom, removeRoom } = useRoomsCache()

  useEffect(() => {
    if (!isConnected) return

    const unsubscribeLobbySubscribed = onServerEvent(on, 'lobby_subscribed', () => {
      setIsSubscribed(true)
    })

    const unsubscribeCreated = onServerEvent(on, 'room_created', (data) => {
      addRoom(data.room)
    })

    const unsubscribeUpdated = onServerEvent(on, 'room_updated', (data) => {
      updateRoom(data.roomId, { memberCount: data.memberCount })
    })

    const unsubscribeDeleted = onServerEvent(on, 'room_deleted', (data) => {
      removeRoom(data.roomId)
    })

    // Subscribe to lobby AFTER handlers are registered
    send('subscribe_lobby', {})

    return () => {
      unsubscribeLobbySubscribed()
      unsubscribeCreated()
      unsubscribeUpdated()
      unsubscribeDeleted()
      setIsSubscribed(false)
    }
  }, [isConnected, on, send, addRoom, updateRoom, removeRoom])

  return { isSubscribed }
}
