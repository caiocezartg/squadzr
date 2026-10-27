'use client'

import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ds/popover'
import type { UserNotification } from '@/types'
import { BellButton } from './notifications-bell-button'
import { NotificationsPanel } from './notifications-panel'

export interface NotificationsPopoverProps {
  readonly notifications: readonly UserNotification[]
  readonly unreadCount: number
  readonly busy: boolean
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
  open,
  onOpenChange,
  onOpen,
  onDismiss,
  onMarkAllAsRead,
}: NotificationsPopoverProps) {
  const t = useTranslations('ds.notifications')

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
      className="p-0 pb-[env(safe-area-inset-bottom)] sm:w-100"
      trigger={<BellButton unreadCount={unreadCount} />}
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
