import { CHAT } from '@squadzr/schemas'
import type { Clock } from '@domain/services/clock.interface'

/**
 * One socket's typing frames: at most one is forwarded per throttle. A frame it refuses is dropped
 * silently, since a client that sends typing more often is merely eager, not invalid.
 */
export class TypingThrottle {
  private lastForwardedAt: number | null = null

  constructor(private readonly clock: Clock) {}

  /** Records the frame and says whether to forward it; a dropped frame does not move the window. */
  allow(): boolean {
    const now = this.clock.now().getTime()
    if (this.lastForwardedAt !== null && now - this.lastForwardedAt < CHAT.TYPING_THROTTLE_MS)
      return false
    this.lastForwardedAt = now
    return true
  }
}
