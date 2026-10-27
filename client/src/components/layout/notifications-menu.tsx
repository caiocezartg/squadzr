'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ds/popover'
import { useNotifications } from '@/hooks/use-notifications'
import { useAppNavigation } from '@/lib/navigation'
import { lobbyHref } from '@/lib/squad-links'
import type { UserNotification } from '@/types'
import { BellButton } from './notifications-bell-button'
import { NotificationsPanel } from './notifications-panel'

/**
 * The viewer's notifications: the bell and its panel, a popover below the bell from 640px and a
 * bottom sheet below. It reads, polls and announces the notifications, so only one is ever mounted.
 */
export function NotificationsMenu() {
  const t = useTranslations('ds.notifications')
  const navigate = useAppNavigation()
  const [open, setOpen] = useState(false)
  const {
    notifications,
    unreadCount,
    markAsRead,
    isMarkingAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
    deleteNotification,
    isDeletingNotification,
  } = useNotifications({ enabled: true, limit: 10 })

  const busy = isMarkingAsRead || isMarkingAllAsRead || isDeletingNotification

  // A failed change is already shown as an error toast by its mutation, so the handlers only stop
  // there; the rejection is not left unhandled.
  const handleOpen = async (notification: UserNotification) => {
    if (!notification.readAt) {
      try {
        await markAsRead(notification.id)
      } catch {
        return
      }
    }
    setOpen(false)
    navigate(lobbyHref(notification.payload.roomCode))
  }

  return (
    <Popover
      side="bottom"
      align="end"
      sideOffset={10}
      bottomSheet
      open={open}
      onOpenChange={setOpen}
      title={t('title')}
      hideTitle
      className="p-0 pb-[env(safe-area-inset-bottom)] sm:w-100"
      trigger={<BellButton unreadCount={unreadCount} />}
    >
      <NotificationsPanel
        notifications={notifications}
        unreadCount={unreadCount}
        busy={busy}
        onOpen={(notification) => void handleOpen(notification)}
        onDismiss={(notification) =>
          void deleteNotification(notification.id).catch(() => undefined)
        }
        onMarkAllAsRead={() => void markAllAsRead().catch(() => undefined)}
      />
    </Popover>
  )
}
