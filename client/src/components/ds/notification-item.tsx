'use client'

import type { MouseEvent } from 'react'
import { Gamepad2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DiscordIcon } from '@/components/ui/icons'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

export interface NotificationItemProps {
  readonly squadName: string
  readonly gameName: string
  /** The game cover; without it the cover slot keeps a neutral placeholder. */
  readonly coverUrl?: string | null
  /** ISO time the notification happened. */
  readonly createdAt: string
  readonly unread: boolean
  /** The Squad's address: the row is a link to it. */
  readonly href: string
  /** Both controls wait while a change is in flight. */
  readonly disabled?: boolean
  /** A plain click opens the Squad here; a modified click keeps the browser's own link behaviour. */
  readonly onOpen: () => void
  readonly onDismiss: () => void
}

/**
 * A "Squad ready" notification as a row of the notifications panel (reference, Components): the
 * game cover with a Discord badge, the Squad name, the message, and the game with the relative
 * time. Unread shows a mint edge, a bold name with a small mint dot and a hidden "unread" text; a read cover is 60% grayscale. It is a
 * list item, so the parent is a `ul` or `ol`. The dismiss button shows on hover and on focus, and
 * always on a touch screen, which has no hover.
 */
export function NotificationItem({
  squadName,
  gameName,
  coverUrl,
  createdAt,
  unread,
  href,
  disabled,
  onOpen,
  onDismiss,
}: NotificationItemProps) {
  const t = useTranslations('ds.notifications')
  const timeAgo = useTimeAgo(createdAt)

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
        onClick={handleClick}
        className={cn(
          'hover-fine:bg-line hover-fine:[--ground:var(--color-line)] focus-visible:outline-text flex w-full items-center gap-3.5 py-2.5 pr-14 pl-2.5 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2',
          unread
            ? 'bg-raised-2 [--ground:var(--color-raised-2)] shadow-[inset_2px_0_0_var(--color-mint)]'
            : 'bg-raised [--ground:var(--color-raised)]'
        )}
      >
        <span className="relative h-12.5 w-9.5 shrink-0">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              loading="lazy"
              className={cn('block size-full object-cover', !unread && 'grayscale-60')}
            />
          ) : (
            <span className="bg-track text-ds-muted flex size-full items-center justify-center">
              <Gamepad2 aria-hidden className="size-4" />
            </span>
          )}
          <span className="bg-ds-discord absolute -right-1.25 -bottom-1.25 flex size-5 items-center justify-center text-white shadow-[0_0_0_2px_var(--ground)]">
            <DiscordIcon aria-hidden className="size-3" />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.75">
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'truncate text-sm',
                unread ? 'text-text font-bold' : 'text-text-3 font-semibold'
              )}
            >
              {squadName}
            </span>
            {unread && <span aria-hidden className="bg-mint size-1.5 shrink-0 rounded-full" />}
          </span>
          <span className={cn('text-[12.5px]', unread ? 'text-text-2' : 'text-ds-muted')}>
            {t('message')}
          </span>
          <span className="text-ds-muted text-[11.5px]">
            {gameName} · {timeAgo}
          </span>
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
