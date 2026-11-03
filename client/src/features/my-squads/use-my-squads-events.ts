import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannelHandlers, RealtimeSubscription } from '@/lib/ws-client'
import { mySquadsQueryKey } from './my-squads-cache'

interface UseMySquadsEventsOptions {
  /** Ids of the squads the sidebar lists; an event about any other squad is not the viewer's. */
  readonly squadIds: readonly string[]
  readonly subscribe: (
    subscription: RealtimeSubscription,
    handlers: RealtimeChannelHandlers
  ) => () => void
}

/**
 * Keeps the sidebar's list live for every member, wherever they are in the app. The lobby stream
 * reports each Membership change of a public squad (`room_updated`), and a squad that fills up or
 * closes (`room_removed`); the sidebar listens on its own socket, so a page without one still
 * hears them. An event about a squad in the list reads the list again instead of patching it, and a
 * restored subscription reads it too, which repairs events missed while the socket was down.
 */
export function useMySquadsEvents({ squadIds, subscribe }: UseMySquadsEventsOptions): void {
  const queryClient = useQueryClient()
  const squadIdsRef = useRef(squadIds)
  const hasSubscribedRef = useRef(false)

  useEffect(() => {
    squadIdsRef.current = squadIds
  }, [squadIds])

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: mySquadsQueryKey })
    const refreshIfListed = ({ roomId }: { roomId: string }) => {
      if (squadIdsRef.current.includes(roomId)) refresh()
    }

    return subscribe(
      { type: 'subscribe_lobby' },
      {
        lobby_subscribed: () => {
          if (!hasSubscribedRef.current) {
            hasSubscribedRef.current = true
            return
          }
          refresh()
        },
        room_updated: refreshIfListed,
        room_removed: refreshIfListed,
      }
    )
  }, [subscribe, queryClient])
}
