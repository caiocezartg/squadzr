import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onServerEvent } from '@/lib/ws-validators'
import type { RealtimeEventSubscribe } from '@/lib/ws-client'
import type { NotificationsResponse } from '@/types'

interface UseNotificationEventsOptions {
  on: RealtimeEventSubscribe
}

/**
 * Applies the user-targeted `notification` push to the React Query cache as
 * soon as it arrives on an open socket. The 30 s polling in `useNotifications`
 * stays as the fallback for pages without a socket; an already-cached
 * notification is never duplicated.
 */
export function useNotificationEvents({ on }: UseNotificationEventsOptions): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    return onServerEvent(on, 'notification', ({ notification }) => {
      queryClient.setQueriesData<NotificationsResponse>(
        { queryKey: ['notifications'] },
        (current) => {
          if (!current) return current
          if (current.notifications.some((existing) => existing.id === notification.id)) {
            return current
          }
          return { notifications: [notification, ...current.notifications] }
        }
      )
    })
  }, [on, queryClient])
}
