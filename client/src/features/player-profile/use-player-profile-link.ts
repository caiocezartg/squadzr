'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { usePrefetchPlayerProfile } from './player-profile-query'

const PLAYER_PARAMETER = 'player'

/** Marks the history entry that opened a profile, so closing it can step back instead of adding one. */
const OPENED_PROFILE_STATE = { squadzrPlayerProfile: true }

/** Fired after this module writes the URL, since the browser fires nothing for `pushState`. */
const PROFILE_URL_EVENT = 'squadzr:profile-url'

/** The person whose profile the URL asks for, or `null`. */
export function playerFromParams(params: URLSearchParams): string | null {
  const id = params.get(PLAYER_PARAMETER)?.trim()
  return id ? id : null
}

function urlWith(pathname: string, params: URLSearchParams, playerId: string | null): string {
  const next = new URLSearchParams(params)
  if (playerId) next.set(PLAYER_PARAMETER, playerId)
  else next.delete(PLAYER_PARAMETER)
  return next.size > 0 ? `${pathname}?${next}` : pathname
}

/** The URL the browser is on now, as the profile reads and rewrites it. */
function currentUrl(): { readonly pathname: string; readonly params: URLSearchParams } {
  return {
    pathname: window.location.pathname,
    params: new URLSearchParams(window.location.search),
  }
}

function writeProfileUrl(write: (url: string) => void, playerId: string | null): void {
  const { pathname, params } = currentUrl()
  write(urlWith(pathname, params, playerId))
  window.dispatchEvent(new Event(PROFILE_URL_EVENT))
}

function openedByThisApp(): boolean {
  const state: unknown = window.history.state
  return typeof state === 'object' && state !== null && 'squadzrPlayerProfile' in state
}

function subscribeToUrl(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(PROFILE_URL_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(PROFILE_URL_EVENT, onChange)
  }
}

/**
 * The person the address bar asks for. It reads `window.location` itself: the profile writes the URL
 * through `window.history` and must see its own writes, Back and Forward included, whatever the App
 * Router has made of them. A navigation the router makes (a link that leaves the profile) re-renders this
 * through `useSearchParams`, and the read then finds the new address.
 */
export function usePlayerFromUrl(): string | null {
  useSearchParams()
  return useSyncExternalStore(
    subscribeToUrl,
    () => playerFromParams(currentUrl().params),
    () => null
  )
}

export interface PlayerProfileLink {
  /** Opens a person's profile over the current page, in the URL. The page stays mounted. */
  readonly open: (playerId: string) => void
  /** The address that opens a person's profile over the current page. */
  readonly hrefFor: (playerId: string) => string
  /** Reads a profile ahead of `open`. */
  readonly prefetch: (playerId: string) => void
}

/**
 * Opens player profiles. The profile is a dialog the URL carries as `?player=<id>`, so the page below it
 * keeps running (the Lobby's live channel and Presence included). The write goes through `window.history`
 * like the Squad Board's own search writes: the dialog opens at once and no request leaves.
 */
export function usePlayerProfileLink(): PlayerProfileLink {
  const pathname = usePathname()
  const params = useSearchParams()
  const prefetch = usePrefetchPlayerProfile()

  const hrefFor = useCallback(
    (playerId: string) => urlWith(pathname, params, playerId),
    [pathname, params]
  )
  const open = useCallback(
    (playerId: string) =>
      writeProfileUrl((url) => window.history.pushState(OPENED_PROFILE_STATE, '', url), playerId),
    []
  )

  return useMemo(() => ({ open, hrefFor, prefetch }), [open, hrefFor, prefetch])
}

/**
 * Takes the profile out of the URL. A profile this app opened leaves by going back, so it adds no
 * history entry; one opened by a shared link has nothing to go back to, so the URL is rewritten in place.
 */
export function useCloseProfileFromUrl(): () => void {
  const router = useRouter()

  return useCallback(() => {
    if (openedByThisApp()) router.back()
    else writeProfileUrl((url) => window.history.replaceState(null, '', url), null)
  }, [router])
}
