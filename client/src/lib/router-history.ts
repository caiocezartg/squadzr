import { createBrowserHistory } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'

/**
 * Browser history for the router, kept apart from the global `window.history`.
 *
 * Next's App Router writes the URL itself after each commit, from an insertion effect.
 * TanStack Router wraps the global `window.history` methods and reloads its routes on every
 * write, so each of Next's writes started a route load inside that insertion effect, which React
 * rejects ("useInsertionEffect must not schedule updates."). The router gets a view of the window
 * whose `history` forwards to the real one instead. Its own writes still reach the real history,
 * so Next keeps its URL state in sync, while Next's writes no longer reach the router.
 *
 * The history reads the URL when it is created and keeps its own copy after that, so it does not
 * see Next's writes at all. Create one per mount of the old app and destroy it when the mount ends.
 */
export function createRouterHistory(): RouterHistory {
  const realHistory = window.history

  return createBrowserHistory({
    window: {
      location: window.location,
      addEventListener: window.addEventListener.bind(window),
      removeEventListener: window.removeEventListener.bind(window),
      history: {
        get state() {
          return realHistory.state
        },
        get length() {
          return realHistory.length
        },
        pushState: (data: unknown, unused: string, url?: string | URL | null) =>
          realHistory.pushState(data, unused, url),
        replaceState: (data: unknown, unused: string, url?: string | URL | null) =>
          realHistory.replaceState(data, unused, url),
        go: (delta?: number) => realHistory.go(delta),
        back: () => realHistory.back(),
        forward: () => realHistory.forward(),
      },
    },
  })
}
