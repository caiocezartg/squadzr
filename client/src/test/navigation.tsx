/**
 * The harness's in-memory location. `next/navigation` and `next/link` (mocked for the suite) read and
 * write this one location, and every call made through the Next router is recorded in order, so a
 * test can assert what the app asked for and not only where it ended.
 *
 * The active navigation is the one the latest harness render (or `createHarnessNavigation`) made.
 */

import { useMemo, useSyncExternalStore } from 'react'
import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { act } from '@testing-library/react'

export type NavigationCall =
  | { readonly method: 'push' | 'replace'; readonly href: string }
  | { readonly method: 'redirect'; readonly href: string }
  | { readonly method: 'back' | 'forward' | 'refresh' }

export interface HarnessLocation {
  readonly pathname: string
  readonly search: string
  readonly hash: string
}

/** The location the App Router hooks read, with the history operations the harness drives. */
export interface HarnessHistory {
  readonly location: HarnessLocation
  push: (url: string) => void
  replace: (url: string) => void
  back: () => void
  forward: () => void
  subscribe: (listener: () => void) => () => void
}

/** The router object that `next/navigation`'s `useRouter` returns. */
export interface HarnessRouter {
  push: (href: string) => void
  replace: (href: string) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string) => void
}

export interface HarnessNavigation {
  /** The one location. The Next hooks and links drive it. */
  readonly history: HarnessHistory
  readonly router: HarnessRouter
  /** Every call made through the router or a plain click on a link, in order. */
  readonly calls: NavigationCall[]
}

let active: HarnessNavigation | undefined

/**
 * A router navigation is applied on a timer, as the App Router commits a navigation as a transition.
 * A direct location write (the page's own `window.history` write) before it lands cancels it, as the
 * App Router discards a navigation that the page superseded before it committed.
 */
let pendingNavigation: ReturnType<typeof setTimeout> | null = null
let applyingRouterNavigation = false

function cancelPendingNavigation(): void {
  if (pendingNavigation === null) return
  clearTimeout(pendingNavigation)
  pendingNavigation = null
}

function scheduleNavigation(run: () => void): void {
  cancelPendingNavigation()
  pendingNavigation = setTimeout(() => {
    pendingNavigation = null
    applyingRouterNavigation = true
    try {
      run()
    } finally {
      applyingRouterNavigation = false
    }
  }, 0)
}

/** The path, search and hash of a URL, resolved against the window's URL, as a location holds them. */
function locationHref(url: string | URL): string {
  const resolved = new URL(String(url), window.location.href)
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}

function parseLocation(url: string | URL): HarnessLocation {
  const resolved = new URL(String(url), window.location.href)
  return { pathname: resolved.pathname, search: resolved.search, hash: resolved.hash }
}

/** A small in-memory history: a stack of locations and the index of the current one. */
function createHarnessHistory(initial: string): HarnessHistory {
  let entries = [parseLocation(initial)]
  let index = 0
  let location = entries[index] as HarnessLocation
  const listeners = new Set<() => void>()

  const notify = (): void => {
    location = entries[index] as HarnessLocation
    for (const listener of listeners) listener()
  }

  return {
    get location() {
      return location
    },
    push: (url) => {
      if (!applyingRouterNavigation) cancelPendingNavigation()
      entries = [...entries.slice(0, index + 1), parseLocation(url)]
      index = entries.length - 1
      notify()
    },
    replace: (url) => {
      if (!applyingRouterNavigation) cancelPendingNavigation()
      entries[index] = parseLocation(url)
      notify()
    },
    back: () => {
      if (index === 0) return
      index -= 1
      notify()
    },
    forward: () => {
      if (index === entries.length - 1) return
      index += 1
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/** A fresh in-memory location at `url`, which becomes the active one the Next mocks read. */
export function createHarnessNavigation(url: string): HarnessNavigation {
  cancelPendingNavigation()
  const history = createHarnessHistory(url)
  const calls: NavigationCall[] = []
  const router: HarnessRouter = {
    push: (href) => {
      calls.push({ method: 'push', href })
      scheduleNavigation(() => history.push(href))
    },
    replace: (href) => {
      calls.push({ method: 'replace', href })
      scheduleNavigation(() => history.replace(href))
    },
    back: () => {
      calls.push({ method: 'back' })
      history.back()
    },
    forward: () => {
      calls.push({ method: 'forward' })
      history.forward()
    },
    refresh: () => {
      calls.push({ method: 'refresh' })
    },
    prefetch: () => undefined,
  }

  active = { history, router, calls }
  return active
}

/** Lets a router navigation queued by the harness commit, inside `act` so React processes the page swap. */
export async function settleNavigation(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

/** Forgets the active navigation between tests. */
export function resetHarnessNavigation(): void {
  cancelPendingNavigation()
  active = undefined
}

function currentNavigation(): HarnessNavigation {
  return active ?? createHarnessNavigation('/')
}

/**
 * The App Router patches `window.history`, so a write through it moves the URL that the Next hooks read
 * (`useSearchParams`, `usePathname`) without a navigation. The bridge does the same for the active location:
 * a write moves it and the window's own URL, and it is never recorded as a router call.
 */
export function bridgeWindowHistory(): void {
  const history = window.history
  const pushState = history.pushState.bind(history)
  const replaceState = history.replaceState.bind(history)

  history.pushState = (data, unused, url) => {
    if (url != null) active?.history.push(locationHref(url))
    pushState(data, unused, url)
  }
  history.replaceState = (data, unused, url) => {
    if (url != null) active?.history.replace(locationHref(url))
    replaceState(data, unused, url)
  }
}

function useLocationValue(select: (location: HarnessLocation) => string): string {
  const { history } = currentNavigation()
  const read = () => select(history.location)
  // The server render reads the same location, so it takes the same snapshot.
  return useSyncExternalStore(history.subscribe, read, read)
}

function useHarnessRouter(): HarnessRouter {
  return currentNavigation().router
}

function useHarnessPathname(): string {
  return useLocationValue((location) => location.pathname)
}

function useHarnessSearchParams(): URLSearchParams {
  const search = useLocationValue((location) => location.search)
  return useMemo(() => new URLSearchParams(search), [search])
}

/** The error Next's `redirect` throws once it has recorded the destination. */
export class RedirectError extends Error {
  constructor(readonly href: string) {
    super(`Redirected to ${href}`)
    this.name = 'RedirectError'
  }
}

/**
 * `next/navigation`'s `redirect` for the suite: records the destination on the active location and
 * throws, as Next does, so the caller stops rendering where the real redirect would.
 */
export function redirect(href: string): never {
  active?.calls.push({ method: 'redirect', href })
  throw new RedirectError(href)
}

/** What the suite's `next/navigation` mock exports. */
export const nextNavigationMock = {
  useRouter: useHarnessRouter,
  usePathname: useHarnessPathname,
  useSearchParams: useHarnessSearchParams,
  redirect,
}

interface HarnessLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  readonly href: string
  readonly replace?: boolean
  readonly children?: ReactNode
}

/**
 * A plain left click on the same window is the only click the harness routes itself. Modified
 * clicks, other buttons and `target` keep the browser's anchor behaviour.
 */
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>, anchor: HarnessLinkProps): boolean {
  const modified = event.metaKey || event.altKey || event.ctrlKey || event.shiftKey
  const sameWindow = anchor.target === undefined || anchor.target === '_self'
  return event.button === 0 && !modified && sameWindow && anchor.download === undefined
}

/**
 * `next/link` for the suite. It stays an anchor with its `href`, so the browser keeps its normal
 * anchor semantics. A plain left click routes through the harness location, as the app's link routes
 * through the app router.
 */
function HarnessLink({ href, replace, onClick, children, ...anchor }: HarnessLinkProps) {
  const router = useHarnessRouter()

  return (
    <a
      {...anchor}
      href={href}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || !isPlainLeftClick(event, { href, ...anchor })) return

        event.preventDefault()
        if (replace) router.replace(href)
        else router.push(href)
      }}
    >
      {children}
    </a>
  )
}

/** What the suite's `next/link` mock exports. */
export const nextLinkMock = { default: HarnessLink }
