'use client'

import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/components/ds/use-media-query'
import { useSession } from '@/hooks/use-session'
import { NotificationsMenu } from './notifications-menu'

/** 1024px and up: the widths where the sidebar is a column and the page header carries the bell. */
export const WIDE_QUERY = '(min-width: 1024px)'

interface NotificationsBellProps {
  /**
   * Where the bell sits. At wide widths the page's header holds it; below them the top bar does. Only
   * the matching placement renders, so there is never more than one bell, and the notifications are
   * read, polled and announced once.
   */
  readonly placement: 'page' | 'top-bar'
}

/** The viewer's notifications menu in one of its two places. A visitor has none. */
export function NotificationsBell({ placement }: NotificationsBellProps) {
  const session = useSession()
  const wide = useMediaQuery(WIDE_QUERY)

  if (!session?.user || wide !== (placement === 'page')) return null

  return <OpenableNotificationsMenu />
}

/** The menu with its open state: a press outside it closes the panel. */
function OpenableNotificationsMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef}>
      <NotificationsMenu
        enabled
        isOpen={open}
        onToggle={() => setOpen((current) => !current)}
        onClose={() => setOpen(false)}
      />
    </div>
  )
}
