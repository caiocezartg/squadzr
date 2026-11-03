import type { Clock } from '@domain/services/clock.interface'

const MESSAGE_RATE_WINDOW_MS = 10_000
/** Valid messages a socket may send per window, pings aside: far above what the app sends, far below a loop. */
export const MESSAGE_RATE_LIMIT = 40
/** Pings a socket may send per window. A ping costs only its pong, so its own, looser rate. */
export const PING_RATE_LIMIT = 120

/**
 * The messages of one kind a socket sent in the last window, so a busy loop cannot keep the server
 * busy: valid messages, which reach the database, or pings.
 */
export class MessageRate {
  private sent: number[] = []

  constructor(
    private readonly clock: Clock,
    private readonly limit: number = MESSAGE_RATE_LIMIT
  ) {}

  /** Records the message and says whether it is within the rate; a refused message is not counted. */
  allow(): boolean {
    const now = this.clock.now().getTime()
    this.sent = this.sent.filter((at) => now - at < MESSAGE_RATE_WINDOW_MS)
    if (this.sent.length >= this.limit) return false
    this.sent.push(now)
    return true
  }
}
