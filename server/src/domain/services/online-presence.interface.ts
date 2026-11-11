/**
 * Who is online right now: signed-in users with at least one open realtime connection. Guests are
 * not counted. The API runs as a single instance, so this reads the in-memory connection registry.
 */
export interface OnlinePresence {
  /** Distinct signed-in users with at least one open realtime connection. */
  countOnlineUsers(): number
  /** Whether this user has at least one open realtime connection. */
  isUserOnline(userId: string): boolean
}
