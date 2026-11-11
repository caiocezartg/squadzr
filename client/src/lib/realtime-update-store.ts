/**
 * What the realtime update notice shows. `reloading` is the transient state while the page reloads
 * into the matching build; `manual` is the persistent state with a reload button once the automatic
 * reload is no longer allowed. `null` shows nothing.
 */
export type RealtimeUpdateNoticeState = 'reloading' | 'manual' | null

let state: RealtimeUpdateNoticeState = null
const listeners = new Set<() => void>()

/** External store read with `useSyncExternalStore` by the notice component. */
export function subscribeToRealtimeUpdateNotice(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getRealtimeUpdateNotice(): RealtimeUpdateNoticeState {
  return state
}

/** The server never renders the notice: it only appears after a protocol failure in the browser. */
export function getServerRealtimeUpdateNotice(): RealtimeUpdateNoticeState {
  return null
}

export function setRealtimeUpdateNotice(next: RealtimeUpdateNoticeState): void {
  if (state === next) return
  state = next
  listeners.forEach((listener) => listener())
}
