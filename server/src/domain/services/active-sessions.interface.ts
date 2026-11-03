/**
 * Which sign-in sessions are still live. A realtime socket keeps the session it opened with, so it
 * asks this from time to time and closes once its session was signed out or expired.
 */
export interface ActiveSessions {
  /** The ids among `sessionIds` whose session still exists and has not expired. */
  findActive(sessionIds: readonly string[]): Promise<ReadonlySet<string>>
}
