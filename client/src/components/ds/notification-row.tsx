'use client'

import type { MouseEvent, ReactNode } from 'react'
import { Gamepad2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'
import { NOTIFICATION_TONES, type NotificationType } from './notification-tone'

/**
 * The 44×58 media slot of a notification row: a cover or an avatar, with a 24px badge in the type's
 * tone on its lower right corner. The badge rings itself with the row's ground (`--ground`), set by
 * the row.
 */
export function NotificationMedia({
  type,
  children,
}: {
  readonly type: NotificationType
  readonly children: ReactNode
}) {
  const { badge, BadgeIcon } = NOTIFICATION_TONES[type]
  return (
    <span className="relative flex h-14.5 w-11 shrink-0 items-center justify-center">
      {children}
      <span
        aria-hidden
        className={cn(
          'absolute -right-1.75 -bottom-1.75 flex size-6 items-center justify-center shadow-[0_0_0_2px_var(--ground)]',
          badge
        )}
      >
        <BadgeIcon className="size-3.5" />
      </span>
    </span>
  )
}

/** The game cover; without it the slot keeps a neutral placeholder. */
export function NotificationCover({
  coverUrl,
  className,
}: {
  readonly coverUrl?: string | null | undefined
  /** How the picture is dimmed: a closed Squad greys it. */
  readonly className?: string | undefined
}) {
  if (!coverUrl) {
    return (
      <span className="bg-track text-muted flex size-full items-center justify-center">
        <Gamepad2 aria-hidden className="size-4" />
      </span>
    )
  }
  return (
    <img
      src={coverUrl}
      alt=""
      loading="lazy"
      className={cn('block size-full object-cover', className)}
    />
  )
}

/**
 * What kind of thing happened, in the type's tone, above the title. It repeats what the row's label
 * or message already says, so it is hidden from assistive technology. An unread row ends it with a
 * mint dot.
 */
function NotificationEyebrow({
  type,
  unread,
}: {
  readonly type: NotificationType
  readonly unread: boolean
}) {
  const t = useTranslations('ds.notifications.eyebrow')
  const { text, Icon } = NOTIFICATION_TONES[type]
  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.09em] uppercase',
        text,
        !unread && 'opacity-60'
      )}
    >
      <Icon className="size-3 shrink-0" strokeWidth={2.4} />
      <span className="truncate">{t(type)}</span>
      {unread && <span className="bg-mint ml-auto size-1.75 shrink-0 rounded-full" />}
    </span>
  )
}

export interface NotificationRowProps {
  readonly type: NotificationType
  readonly media: ReactNode
  readonly squadName: string
  /** The title; the Squad name by default. */
  readonly title?: ReactNode
  /** What happened, below the title. */
  readonly message: ReactNode
  readonly gameName: string
  /** ISO time the notification happened. */
  readonly createdAt: string
  /** Drawn before the game and the time, on the same line. */
  readonly metaLead?: ReactNode
  /** Drawn below the game and the time. */
  readonly children?: ReactNode
  readonly unread: boolean
  /** Where the row leads: it is a link. */
  readonly href: string
  /**
   * Names the row after the action when its text alone would name only the Squad. The unread text
   * is appended, so the name still says it.
   */
  readonly label?: string
  /** Both controls wait while a change is in flight. */
  readonly disabled?: boolean | undefined
  /** A plain click opens the row here; a modified click keeps the browser's own link behaviour. */
  readonly onOpen: () => void
  readonly onDismiss: () => void
}

/**
 * The structure every notification shares (reference, Components): the media, an eyebrow in the
 * type's tone, the title, the message, and the game with the relative time. Unread shows an edge in
 * the type's tone, a mint dot on the eyebrow and a hidden "unread" text; read dims the media and the
 * eyebrow. It is a list item, so the parent is a `ul` or `ol`. The dismiss button shows on hover and
 * on focus, and always on a touch screen, which has no hover.
 */
export function NotificationRow({
  type,
  media,
  squadName,
  title = squadName,
  message,
  gameName,
  createdAt,
  metaLead,
  children,
  unread,
  href,
  label,
  disabled,
  onOpen,
  onDismiss,
}: NotificationRowProps) {
  const t = useTranslations('ds.notifications')
  const timeAgo = useTimeAgo(createdAt)
  const tone = NOTIFICATION_TONES[type]

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const modified = event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
    if (event.button !== 0 || modified) return
    event.preventDefault()
    if (!disabled) onOpen()
  }

  return (
    <li className="group relative">
      <a
        href={href}
        aria-disabled={disabled || undefined}
        aria-label={label ? (unread ? `${label}, ${t('unread')}` : label) : undefined}
        onClick={handleClick}
        className={cn(
          'hover-fine:bg-line hover-fine:[--ground:var(--color-line)] focus-visible:outline-text flex w-full items-start gap-3.25 py-3 pr-14 pl-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2',
          unread
            ? cn('bg-raised-2 [--ground:var(--color-raised-2)]', tone.edge)
            : 'bg-raised [--ground:var(--color-raised)]'
        )}
      >
        <span className={cn('shrink-0', !unread && 'opacity-60')}>{media}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <NotificationEyebrow type={type} unread={unread} />
          <span className={cn('truncate text-[14.5px] font-bold', tone.title)}>{title}</span>
          <span className="text-text-2 text-[12.75px] leading-[1.45] wrap-anywhere">{message}</span>
          <span className="text-muted flex min-w-0 items-center gap-2 text-[11.5px]">
            {metaLead}
            <span className="truncate">
              {gameName} · {timeAgo}
            </span>
          </span>
          {children}
        </span>
        {unread && <span className="sr-only">{t('unread')}</span>}
      </a>
      <button
        type="button"
        disabled={disabled}
        onClick={onDismiss}
        aria-label={t('dismiss', { squad: squadName })}
        className="bg-track text-text-2 hover-fine:text-text focus-visible:outline-text absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center opacity-0 transition-[opacity,color] duration-150 group-hover-fine:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:-outline-offset-2 pointer-coarse:opacity-100"
      >
        <X aria-hidden className="size-3" strokeWidth={2.8} />
      </button>
    </li>
  )
}
