import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateSquadBoard, removeSquadFromBoard } from './squad-board-cache'
import { createSquadBoardRefetchScheduler } from './squad-board-refetch-scheduler'
import type { RealtimeChannelHandlers, RealtimeSubscription } from '@/lib/ws-client'

interface UseSquadBoardEventsOptions {
  subscribe: (subscription: RealtimeSubscription, handlers: RealtimeChannelHandlers) => () => void
}

/**
 * Keeps the board authoritative on the realtime stream. Every board event
 * refetches the board query instead of patching cached data, so a Ready or
 * expired squad cannot reappear through an event that arrives late or through a
 * local cache the event no longer describes. Refetches are coalesced: a burst
 * of events produces one request after the events stop, and a continuous burst
 * still refetches once per second. A removed squad leaves the screen on the
 * event itself, before the coalesced refetch lands. The transport owns
 * resubscription, so the handlers are registered once and replay after every
 * reconnect; a restored subscription also refetches, which repairs events
 * missed while the socket was down. Dropping a pending refetch at unmount is
 * safe: the squads query re-reads on every mount (`refetchOnMount: 'always'`),
 * so the next visit re-reads the authoritative list regardless.
 */
export function useSquadBoardEvents({ subscribe }: UseSquadBoardEventsOptions): void {
  const queryClient = useQueryClient()
  const hasSubscribedRef = useRef(false)

  useEffect(() => {
    const refetcher = createSquadBoardRefetchScheduler({
      refetch: () => invalidateSquadBoard(queryClient),
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
          removeSquadFromBoard(queryClient, roomId)
          refetcher.schedule()
        },
      }
    )

    return () => {
      unsubscribe()
      // A pending refetch is dropped: no page is left to receive its
      // response, and the next mount re-reads the board on its own.
      refetcher.cancel()
    }
  }, [subscribe, queryClient])
}
