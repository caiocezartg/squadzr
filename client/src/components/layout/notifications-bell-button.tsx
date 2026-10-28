import type { ComponentProps } from 'react'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/** Counts above this read "9+" in the badge. */
const BADGE_CAP = 9

interface BellButtonProps extends ComponentProps<'button'> {
  readonly unreadCount: number
}

/**
 * The bell: a 44px square that opens the notifications panel (reference, Components). The unread
 * count is in its accessible name; the badge is only for the eye and stops at "9+". While the panel
 * is open the bell takes the light ground.
 */
export function BellButton({ unreadCount, className, ...props }: BellButtonProps) {
  const t = useTranslations('ds.notifications')

  return (
    <button
      type="button"
      aria-label={unreadCount > 0 ? t('bellUnread', { count: unreadCount }) : t('bell')}
      className={cn(
        'press bg-card text-text-2 hover-fine:not-data-popup-open:bg-raised focus-visible:outline-text data-popup-open:bg-text data-popup-open:text-bg relative flex size-11 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2',
        className
      )}
      {...props}
    >
      <Bell aria-hidden className="size-5" strokeWidth={2.2} />
      {unreadCount > 0 && (
        <span
          aria-hidden
          className="bg-mint text-mint-ink font-ds-mono shadow-[0_0_0_2px_var(--color-bg)] absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.25 text-[10.5px] font-extrabold"
        >
          {unreadCount > BADGE_CAP ? `${BADGE_CAP}+` : unreadCount}
        </span>
      )}
    </button>
  )
}

/**
 * The bell's footprint before the live bell is in place: the page header shows it from the server's
 * HTML, so the bell does not pop in once the browser knows the width. It is not a control; the live
 * bell takes its place in the same square.
 */
export function BellPlaceholder() {
  return (
    <span
      aria-hidden
      className="bg-card text-text-2 pointer-events-none hidden size-11 shrink-0 items-center justify-center lg:flex"
    >
      <Bell className="size-5" strokeWidth={2.2} />
    </span>
  )
}
