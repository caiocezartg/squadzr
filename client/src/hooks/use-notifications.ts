import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { getUserFriendlyError } from '@/lib/error-messages'
import { notifyError } from '@/lib/notify'
import {
  notificationChangeResponseSchema,
  notificationsResponseSchema,
  readAllNotificationsResponseSchema,
} from '@squadzr/schemas'
import type { UserNotification } from '@/types'

const EMPTY_NOTIFICATIONS: UserNotification[] = []

function playNotificationSound() {
  try {
    const ctx = new AudioContext()
    const tones = [880, 1100]

    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.value = freq

      const start = ctx.currentTime + i * 0.15
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.25, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35)

      osc.start(start)
      osc.stop(start + 0.35)

      if (i === tones.length - 1) {
        osc.onended = () => ctx.close()
      }
    })
  } catch {
    // AudioContext may be unavailable or suspended in some environments
  }
}

/**
 * The three notification changes share one shape: a success refetches the notifications, and a
 * failure shows its message as an error toast.
 */
function useNotificationMutation<TData, TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<TData>
) {
  const queryClient = useQueryClient()
  const t = useTranslations()

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (err) => {
      notifyError(getUserFriendlyError(err, t))
    },
  })
}

interface UseNotificationsOptions {
  enabled: boolean
  limit?: number
}

export function useNotifications(options: UseNotificationsOptions) {
  const { enabled, limit = 20 } = options

  const query = useQuery({
    queryKey: ['notifications', { limit }],
    queryFn: () => api.get(`/api/notifications?limit=${limit}`, notificationsResponseSchema),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    staleTime: 15_000,
  })

  const markAsReadMutation = useNotificationMutation((notificationId: string) =>
    api.post(`/api/notifications/${notificationId}/read`, {}, notificationChangeResponseSchema)
  )

  const markAllAsReadMutation = useNotificationMutation(() =>
    api.post('/api/notifications/read-all', {}, readAllNotificationsResponseSchema)
  )

  const deleteNotificationMutation = useNotificationMutation((notificationId: string) =>
    api.delete(`/api/notifications/${notificationId}`, notificationChangeResponseSchema)
  )

  const notifications = query.data?.notifications ?? EMPTY_NOTIFICATIONS

  const previousIdsRef = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (notifications.length === 0 && previousIdsRef.current === null) return

    const currentIds = new Set(notifications.map((n) => n.id))

    if (previousIdsRef.current === null) {
      previousIdsRef.current = currentIds
      return
    }

    const prevIds = previousIdsRef.current
    const hasNew = notifications.some((n) => !prevIds.has(n.id))
    if (hasNew) {
      playNotificationSound()
    }

    previousIdsRef.current = currentIds
  }, [notifications])

  const unreadCount = notifications.filter((n) => n.readAt === null).length

  return {
    notifications,
    unreadCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    markAsRead: markAsReadMutation.mutateAsync,
    isMarkingAsRead: markAsReadMutation.isPending,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMarkingAllAsRead: markAllAsReadMutation.isPending,
    deleteNotification: deleteNotificationMutation.mutateAsync,
    isDeletingNotification: deleteNotificationMutation.isPending,
  }
}
