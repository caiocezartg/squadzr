import { useTranslations } from 'next-intl'
import { Bell, CheckCheck, Gamepad2, Users, X } from 'lucide-react'
import { useNotifications } from '@/hooks/use-notifications'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { useAppNavigation } from '@/lib/navigation'
import { lobbyHref } from '@/lib/squad-links'
import type { UserNotification } from '@/types'

interface NotificationsMenuProps {
  readonly enabled: boolean
  readonly isOpen: boolean
  readonly onToggle: () => void
  readonly onClose: () => void
}

function NotificationItem({
  notification,
  onNavigate,
  onDismiss,
  disabled,
}: {
  notification: UserNotification
  onNavigate: () => void
  onDismiss: (e: React.MouseEvent) => void
  disabled: boolean
}) {
  const t = useTranslations()
  const timeAgo = useTimeAgo(notification.createdAt)
  const isUnread = !notification.readAt
  const playerCount = notification.payload.players?.length ?? 0

  return (
    <div className="group relative">
      <button
        disabled={disabled}
        onClick={onNavigate}
        className={`w-full rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
          isUnread ? 'bg-accent/6 hover:bg-accent/10' : 'hover:bg-surface-hover'
        }`}
      >
        <div className="flex gap-2.5">
          {/* Icon + unread dot */}
          <div className="flex flex-col items-center pt-0.5">
            <div
              className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${
                isUnread ? 'bg-accent/15 text-accent' : 'bg-surface-light text-muted'
              }`}
            >
              <Gamepad2 className="size-3.5" />
            </div>
            {isUnread && <div className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />}
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p
                className={`text-xs leading-tight ${
                  isUnread ? 'font-semibold text-offwhite' : 'font-medium text-muted'
                }`}
              >
                {notification.payload.roomName}
              </p>
            </div>

            <div className="mt-1 flex items-center gap-1.5">
              <span className="badge-accent text-[9px] px-1.5 py-0">
                {notification.payload.gameName}
              </span>
              <span className="flex items-center gap-0.5 text-[10px] text-muted">
                <Users className="size-2.5" />
                {playerCount}
              </span>
              <span className="text-[10px] text-muted/60 shrink-0 pt-px">{timeAgo}</span>
            </div>

            <p className="mt-1 text-[11px] text-muted/80 leading-snug line-clamp-1">
              {t('notifications.squadReady')}
            </p>
          </div>
        </div>
      </button>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        disabled={disabled}
        className="absolute right-1.5 top-1.5 p-1 rounded-md text-muted/40 opacity-0 group-hover:opacity-100 hover:text-offwhite hover:bg-surface-light transition-all"
        title={t('notifications.dismiss')}
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

export function NotificationsMenu({ enabled, isOpen, onToggle, onClose }: NotificationsMenuProps) {
  const t = useTranslations()
  const navigate = useAppNavigation()
  const {
    notifications,
    unreadCount,
    markAsRead,
    isMarkingAsRead,
    markAllAsRead,
    isMarkingAllAsRead,
    deleteNotification,
    isDeletingNotification,
  } = useNotifications({ enabled, limit: 10 })

  const isBusy = isMarkingAsRead || isMarkingAllAsRead || isDeletingNotification

  // A failed change is already shown as an error toast by its mutation, so the handlers only stop
  // there; the rejection is not left unhandled.
  const handleNotificationClick = async (notification: UserNotification) => {
    if (!notification.readAt) {
      try {
        await markAsRead(notification.id)
      } catch {
        return
      }
    }
    onClose()
    navigate(lobbyHref(notification.payload.roomCode))
  }

  const handleDismiss = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation()
    await deleteNotification(notificationId).catch(() => undefined)
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead().catch(() => undefined)
  }

  return (
    <div className="relative">
      {/* Bell trigger */}
      <button
        onClick={onToggle}
        className="relative flex items-center justify-center rounded-lg p-2 text-muted hover:bg-surface-hover hover:text-offwhite transition-colors"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex size-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-background ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="fixed inset-x-3 top-[calc(3.5rem+8px)] z-50 rounded-xl border border-border bg-surface shadow-2xl shadow-black/60 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[340px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-offwhite">{t('notifications.title')}</h3>
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={isBusy}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-accent transition-colors disabled:opacity-50"
              >
                <CheckCheck className="size-3" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[360px] overflow-y-auto p-1.5 scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="size-10 rounded-full bg-surface-light flex items-center justify-center">
                  <Bell className="size-4 text-muted/50" />
                </div>
                <p className="text-xs text-muted">{t('notifications.empty')}</p>
                <p className="text-[11px] text-muted/60">{t('notifications.emptySubtitle')}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onNavigate={() => handleNotificationClick(notification)}
                    onDismiss={(e) => handleDismiss(e, notification.id)}
                    disabled={isBusy}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <p className="text-center text-[10px] text-muted/50">
                {t('notifications.showing', { count: notifications.length })}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
