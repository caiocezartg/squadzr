'use client'

import { useCallback, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ds/popover'
import type { UserNotification } from '@/types'
import { BellButton } from './notifications-bell-button'
import { NotificationsPanel } from './notifications-panel'

export interface NotificationsPopoverProps {
  readonly notifications: readonly UserNotification[]
  readonly unreadCount: number
  readonly busy: boolean
  /** Puts focus on the bell as it appears, for a viewer who had focus on its earlier twin. */
  readonly takeFocus: boolean
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onOpen: (notification: UserNotification) => void
  readonly onDismiss: (notification: UserNotification) => void
  readonly onMarkAllAsRead: () => void
}

/**
 * The bell with its panel: a popover below the bell from 640px, a bottom sheet below. It lives in its
 * own module because the popover, the sheet and the panel are floating-panel code that the initial
 * JavaScript of a route does not need; the menu loads it when the page is idle.
 */
export function NotificationsPopover({
  notifications,
  unreadCount,
  busy,
  takeFocus,
  open,
  onOpenChange,
  onOpen,
  onDismiss,
  onMarkAllAsRead,
}: NotificationsPopoverProps) {
  const t = useTranslations('ds.notifications')
  // The focus is taken once, as the bell appears, and never again when this renders.
  const pendingFocus = useRef(takeFocus)
  const focusOnce = useCallback((bell: HTMLButtonElement | null) => {
    if (!bell || !pendingFocus.current) return
    pendingFocus.current = false
    bell.focus()
  }, [])

  return (
    <Popover
      side="bottom"
      align="end"
      sideOffset={10}
      bottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      hideTitle
      className="sm:w-100 sm:p-0"
      trigger={<BellButton ref={focusOnce} unreadCount={unreadCount} />}
    >
      <NotificationsPanel
        notifications={notifications}
        unreadCount={unreadCount}
        busy={busy}
        onOpen={onOpen}
        onDismiss={onDismiss}
        onMarkAllAsRead={onMarkAllAsRead}
      />
    </Popover>
  )
}
