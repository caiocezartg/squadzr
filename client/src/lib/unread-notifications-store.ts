/**
 * The unread notification count of the signed-in viewer, which the document title shows in front of
 * the active route's title. The notifications hook writes it while it is mounted; the server never
 * has a count, so the server snapshot is zero.
 */

let unread = 0
const listeners = new Set<() => void>()

/** External store read with `useSyncExternalStore` by the document title. */
export function subscribeToUnreadNotifications(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getUnreadNotifications(): number {
  return unread
}

export function getServerUnreadNotifications(): number {
  return 0
}

export function setUnreadNotifications(count: number): void {
  if (unread === count) return
  unread = count
  listeners.forEach((listener) => listener())
}
