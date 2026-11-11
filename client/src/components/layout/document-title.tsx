'use client'

import { useEffect, useSyncExternalStore } from 'react'
import {
  getServerUnreadNotifications,
  getUnreadNotifications,
  subscribeToUnreadNotifications,
} from '@/lib/unread-notifications-store'

/** The count prefix this component writes, so a new count replaces it instead of stacking. */
const COUNT_PREFIX = /^\(\d+\) /

/**
 * Puts the unread count in front of the active route's title. A route writes its title into the
 * document head (Next's metadata on an App Router page, React's `<title>` on a route of the old app),
 * and that can land after this component's own commit. The head is watched, so the count is added
 * again each time a route writes its title.
 */
export function DocumentTitle() {
  const unread = useSyncExternalStore(
    subscribeToUnreadNotifications,
    getUnreadNotifications,
    getServerUnreadNotifications
  )

  useEffect(() => {
    const withCount = () => {
      const title = document.title.replace(COUNT_PREFIX, '')
      const next = unread > 0 ? `(${unread}) ${title}` : title
      if (document.title !== next) document.title = next
    }

    withCount()
    const observer = new MutationObserver(withCount)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [unread])

  return null
}
