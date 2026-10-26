/**
 * Runs `callback` once the browser has nothing else to do, or after a second where it cannot tell.
 * Returns the function that cancels it. The shell fetches its late code this way.
 */
export function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback)
    return () => window.cancelIdleCallback(handle)
  }
  const timer = window.setTimeout(callback, 1_000)
  return () => window.clearTimeout(timer)
}
