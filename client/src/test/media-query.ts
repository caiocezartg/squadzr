import { vi } from 'vitest'

/**
 * A `window.matchMedia` whose answer a spec controls, for one media query: `set` changes the answer
 * and notifies the listeners, as the browser does when the preference changes. Every other query does
 * not match. The spy is undone by `vi.restoreAllMocks()`.
 */
export function mockMediaQuery(mediaQuery: string, initialMatches: boolean) {
  let matches = initialMatches
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return query === mediaQuery && matches
        },
        media: query,
        onchange: null,
        addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          if (query === mediaQuery) listeners.add(listener)
        },
        removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
          listeners.delete(listener)
        },
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList
  )

  return {
    set(nextMatches: boolean) {
      matches = nextMatches
      for (const listener of listeners) {
        listener({ matches, media: mediaQuery } as MediaQueryListEvent)
      }
    },
  }
}
