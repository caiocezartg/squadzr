import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateCatalogRooms, removeCatalogRoom } from './catalog-query'
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
 * missed while the socket was down. Dropping a pending refetch at unmount is
 * safe: the rooms query re-reads on every mount (`refetchOnMount: 'always'`),
 * so the next visit re-reads the authoritative list regardless.
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
      // A pending refetch is dropped: no page is left to receive its
      // response, and the next mount re-reads the catalog on its own.
      refetcher.cancel()
    }
  }, [subscribe, queryClient])
}
