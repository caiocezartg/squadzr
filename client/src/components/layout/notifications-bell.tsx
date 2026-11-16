'use client'

import { useMediaQuery } from '@/components/ds/use-media-query'
import { useSession } from '@/hooks/use-session'
import { BellPlaceholder } from './notifications-bell-button'
import { NotificationsMenu } from './notifications-menu'
import { WIDE_QUERY } from './wide-query'

interface NotificationsBellProps {
  /**
   * Where the bell sits, beside the logo either way. At wide widths the sidebar holds it; below them the
   * top bar does. Only the matching placement renders the menu, so there is never more than one, and
   * the notifications are read, polled and announced once.
   */
  readonly placement: 'sidebar' | 'top-bar'
}

/** The viewer's notifications menu in one of its two places. A visitor has none. */
export function NotificationsBell({ placement }: NotificationsBellProps) {
  const session = useSession()
  const wide = useMediaQuery(WIDE_QUERY)

  if (!session?.user) return null
  // The sidebar's bell opens its panel toward the page, the top bar's toward the screen's middle.
  if (wide === (placement === 'sidebar')) {
    return <NotificationsMenu align={placement === 'sidebar' ? 'start' : 'end'} />
  }

  // The server and the first client render do not know the width, so they take it as narrow. The
  // sidebar still shows the bell's footprint at wide widths until the menu takes its place.
  return placement === 'sidebar' ? <BellPlaceholder /> : null
}
