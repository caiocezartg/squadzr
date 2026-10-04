import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { onServerEvent } from '@/lib/ws-validators'
import type { RealtimeEventSubscribe } from '@/lib/ws-client'
import type { NotificationsResponse } from '@/types'

interface UseNotificationEventsOptions {
  on: RealtimeEventSubscribe
}

/**
 * Reads the `limit` of a `['notifications', { limit }]` query key. A key
 * without a usable limit is not truncated.
 */
function notificationsLimit(queryKey: readonly unknown[]): number | null {
  const filters = queryKey[1]
  if (typeof filters !== 'object' || filters === null) return null
  const { limit } = filters as { limit?: unknown }
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return null
  return Math.max(0, Math.floor(limit))
}

/**
 * Applies the user-targeted `notification` push to the React Query cache as
 * soon as it arrives on an open socket. The 30 s polling in `useNotifications`
 * stays as the fallback for pages without a socket; an already-cached
 * notification is never duplicated and every cached query keeps its own limit.
 */
export function useNotificationEvents({ on }: UseNotificationEventsOptions): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    return onServerEvent(on, 'notification', ({ notification }) => {
      for (const [queryKey, current] of queryClient.getQueriesData<NotificationsResponse>({
        queryKey: ['notifications'],
      })) {
        if (!current) continue
        if (current.notifications.some((existing) => existing.id === notification.id)) continue
        const notifications = [notification, ...current.notifications]
        const limit = notificationsLimit(queryKey)
        queryClient.setQueryData<NotificationsResponse>(queryKey, {
          notifications: limit === null ? notifications : notifications.slice(0, limit),
        })
      }
    })
  }, [on, queryClient])
}
