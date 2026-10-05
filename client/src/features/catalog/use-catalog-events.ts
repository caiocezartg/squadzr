import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateCatalogRooms, markCatalogRoomsStale, removeCatalogRoom } from './catalog-query'
import { createCatalogRefetchScheduler } from './catalog-refetch-scheduler'
import type { RealtimeChannelHandlers, RealtimeSubscription } from '@/lib/ws-client'

interface UseCatalogEventsOptions {
  subscribe: (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers) => () => void
}

/**
 * Keeps the catalog authoritative on the realtime stream. Every catalog event
 * refetches the catalog query instead of patching cached data, so a Ready or
 * expired room cannot reappear through an event that arrives late or through a
 * local cache the event no longer describes. Refetches are coalesced: a burst
 * of events produces one request after the events stop, and a continuous burst
 * still refetches once per second. A removed room leaves the screen on the
 * event itself, before the coalesced refetch lands. The transport owns
 * resubscription, so the handlers are registered once and replay after every
 * reconnect; a restored subscription also refetches, which repairs events
 * missed while the socket was down. Unmounting while a refetch is still
 * pending marks the catalog stale instead of discarding the intent, so the
 * next mount re-reads the list.
 */
export function useCatalogEvents({ subscribe }: UseCatalogEventsOptions): void {
  const queryClient = useQueryClient()
  const hasSubscribedRef = useRef(false)

  useEffect(() => {
    const refetcher = createCatalogRefetchScheduler({
      refetch: () => invalidateCatalogRooms(queryClient),
    })

    const unsubscribe = subscribe(
      { type: 'subscribe_lobby' },
      {
        lobby_subscribed: () => {
          if (!hasSubscribedRef.current) {
            hasSubscribedRef.current = true
            return
          }
          refetcher.schedule()
        },
        room_created: () => refetcher.schedule(),
        room_updated: () => refetcher.schedule(),
        room_removed: ({ roomId }) => {
          removeCatalogRoom(queryClient, roomId)
          refetcher.schedule()
        },
      }
    )

    return () => {
      unsubscribe()
      // Dropping a pending refetch would also drop the intention to re-read
      // the catalog: the event that asked for it is gone and the cache may
      // still describe the old list. Marking it stale (without a request: the
      // page is unmounting) makes the next mount fetch instead of trusting
      // that cache.
      if (refetcher.cancel()) {
        markCatalogRoomsStale(queryClient)
      }
    }
  }, [subscribe, queryClient])
}
