'use client'

import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useNotifications } from '@/hooks/use-notifications'
import { useAppNavigation } from '@/lib/navigation'
import { lobbyHref } from '@/lib/squad-links'
import { whenIdle } from '@/lib/when-idle'
import type { UserNotification } from '@/types'
import { BellButton } from './notifications-bell-button'
import type { NotificationsPopoverProps } from './notifications-popover'

const loadPopover = () => import('./notifications-popover').then((m) => m.NotificationsPopover)

interface LoadedPopover {
  readonly Popover: ComponentType<NotificationsPopoverProps>
  /** The viewer had focus on the bell the popover's bell replaces. */
  readonly focused: boolean
}

/**
 * The viewer's notifications: the bell and its panel, a popover below the bell from 640px and a
 * bottom sheet below. It reads, polls and announces the notifications, so only one is ever mounted.
 * The bell and its count are in the initial JavaScript; the panel's code loads when the page is idle,
 * and a press before it arrives opens the panel as it lands.
 */
export function NotificationsMenu() {
  const navigate = useAppNavigation()
  const bellRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState<LoadedPopover | null>(null)
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

  const load = (openOnLoad: boolean) => {
    void loadPopover().then((Popover) => {
      const focused = document.activeElement === bellRef.current
      setLoaded((current) => current ?? { Popover, focused })
      if (openOnLoad) setOpen(true)
    })
  }

  useEffect(() => whenIdle(() => load(false)), [])

  if (!loaded) {
    return <BellButton ref={bellRef} unreadCount={unreadCount} onClick={() => load(true)} />
  }

  return (
    <loaded.Popover
      notifications={notifications}
      unreadCount={unreadCount}
      busy={busy}
      takeFocus={loaded.focused}
      open={open}
      onOpenChange={setOpen}
      onOpen={(notification) => void handleOpen(notification)}
      onDismiss={(notification) => void deleteNotification(notification.id).catch(() => undefined)}
      onMarkAllAsRead={() => void markAllAsRead().catch(() => undefined)}
    />
  )
}
