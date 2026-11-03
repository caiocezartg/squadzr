'use client'

import { useSyncExternalStore } from 'react'

/** Below 640px: the narrow widths of docs/design/reference.md, Responsive. */
export const NARROW_QUERY = '(max-width: 639px)'

/**
 * Whether a media query matches, kept up to date when it changes. The server cannot know, so the
 * server render is the one for a query that does not match.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => {
        list.removeEventListener('change', onChange)
      }
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}
