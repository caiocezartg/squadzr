'use client'

import { useSyncExternalStore } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener('change', onChange)
  return () => {
    query.removeEventListener('change', onChange)
  }
}

function getSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

/** The server cannot know the preference, so the server HTML is the full-motion render. */
function getServerSnapshot(): boolean {
  return false
}

/**
 * Whether the viewer asked for reduced motion, kept up to date when the preference changes. Scripted
 * animations read it to keep opacity and colour changes and drop movement, scale and loops
 * (docs/design/reference.md, Motion). CSS motion follows the media query in the global styles.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
