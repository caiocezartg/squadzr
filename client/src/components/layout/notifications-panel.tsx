import { Bell, CheckCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { lobbyHref } from '@/lib/squad-links'
import { NotificationItem } from '@/components/ds/notification-item'
import type { UserNotification } from '@/types'

interface NotificationsPanelProps {
  readonly notifications: readonly UserNotification[]
  readonly unreadCount: number
  /** A change is in flight, so the controls wait. */
  readonly busy: boolean
  readonly onOpen: (notification: UserNotification) => void
  readonly onDismiss: (notification: UserNotification) => void
  readonly onMarkAllAsRead: () => void
}

/**
 * What the notifications popover and bottom sheet hold: the title with the "mark all as read"
 * button, then the list or the empty state. The surface names itself with a hidden title, so this
 * one is only for the eye.
 */
export function NotificationsPanel({
  notifications,
  unreadCount,
  busy,
  onOpen,
  onDismiss,
  onMarkAllAsRead,
}: NotificationsPanelProps) {
  const t = useTranslations('ds.notifications')

  return (
    <>
      {/*
        The popover has no padding of its own (see the menu); the bottom sheet keeps its own, and its
        close button sits in the top right corner, so the row clears it.
      */}
      <div className="flex min-h-11 items-center justify-between gap-2 pb-3.5 max-sm:-mt-2 max-sm:pr-11 sm:pt-4.5 sm:pr-4.5 sm:pl-5">
        <span aria-hidden className="type-panel-title-sm text-text">
          {t('title')}
        </span>
        <button
          type="button"
          onClick={onMarkAllAsRead}
          disabled={unreadCount === 0 || busy}
          aria-label={t('markAllRead')}
          title={t('markAllRead')}
          className="press bg-line text-mint hover-fine:bg-track disabled:text-faint disabled:hover-fine:bg-line focus-visible:outline-text flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <CheckCheck aria-hidden className="size-4.25" strokeWidth={2.4} />
        </button>
      </div>
      {notifications.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 pt-7 pb-8.5 text-center">
          <span className="bg-line text-ds-muted flex size-13 items-center justify-center">
            <Bell aria-hidden className="size-5.5" strokeWidth={2.2} />
          </span>
          <p className="text-text text-[15px] font-bold">{t('emptyTitle')}</p>
          <p className="text-text-3 max-w-65 text-[13px]/normal">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="scrollbar-thin flex flex-col gap-0.5 sm:px-2 sm:pb-2 sm:max-h-96 sm:overflow-y-auto">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              squadName={notification.payload.roomName}
              gameName={notification.payload.gameName}
              coverUrl={notification.payload.gameCoverUrl}
              createdAt={notification.createdAt}
              unread={notification.readAt === null}
              href={lobbyHref(notification.payload.roomCode)}
              disabled={busy}
              onOpen={() => onOpen(notification)}
              onDismiss={() => onDismiss(notification)}
            />
          ))}
        </ul>
      )}
    </>
  )
}
