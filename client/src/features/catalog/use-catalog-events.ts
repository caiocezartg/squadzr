import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateCatalogRooms } from './catalog-query'
import type { RealtimeChannelHandlers, RealtimeSubscription } from '@/lib/ws-client'

interface UseCatalogEventsOptions {
  subscribe: (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers) => () => void
}

/**
 * Keeps the catalog authoritative on the realtime stream. Every catalog event
 * refetches the catalog query instead of patching cached data, so a Ready or
 * expired room cannot reappear through an event that arrives late or through a
 * local cache the event no longer describes. The transport owns
 * resubscription, so the handlers are registered once and replay after every
 * reconnect; a restored subscription also refetches, which repairs events
 * missed while the socket was down.
 */
export function useCatalogEvents({ subscribe }: UseCatalogEventsOptions): void {
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
          void invalidateCatalogRooms(queryClient)
        },
        room_created: () => {
          void invalidateCatalogRooms(queryClient)
        },
        room_updated: () => {
          void invalidateCatalogRooms(queryClient)
        },
        room_removed: () => {
          void invalidateCatalogRooms(queryClient)
        },
      }
    )
  }, [subscribe, queryClient])
}
