'use client'

import { useMediaQuery } from '@/components/ds/use-media-query'
import { useSession } from '@/hooks/use-session'
import { BellPlaceholder } from './notifications-bell-button'
import { NotificationsMenu } from './notifications-menu'
import { WIDE_QUERY } from './wide-query'

interface NotificationsBellProps {
  /**
   * Where the bell sits. At wide widths the page's header holds it; below them the top bar does. Only
   * the matching placement renders the menu, so there is never more than one, and the notifications
   * are read, polled and announced once.
   */
  readonly placement: 'page' | 'top-bar'
}

/** The viewer's notifications menu in one of its two places. A visitor has none. */
export function NotificationsBell({ placement }: NotificationsBellProps) {
  const session = useSession()
  const wide = useMediaQuery(WIDE_QUERY)

  if (!session?.user) return null
  if (wide === (placement === 'page')) return <NotificationsMenu />

  // The server and the first client render do not know the width, so they take it as narrow. The
  // page header still shows the bell's footprint at wide widths until the menu takes its place.
  return placement === 'page' ? <BellPlaceholder /> : null
}
