import type { Clock } from '@domain/services/clock.interface'

const MESSAGE_RATE_WINDOW_MS = 10_000
/** Valid messages a socket may send per window, pings aside: far above what the app sends, far below a loop. */
export const MESSAGE_RATE_LIMIT = 40

/** The valid messages one socket sent in the last window, so a busy loop cannot keep the database busy. */
export class MessageRate {
  private sent: number[] = []

  constructor(private readonly clock: Clock) {}

  /** Records the message and says whether it is within the rate; a refused message is not counted. */
  allow(): boolean {
    const now = this.clock.now().getTime()
    this.sent = this.sent.filter((at) => now - at < MESSAGE_RATE_WINDOW_MS)
    if (this.sent.length >= MESSAGE_RATE_LIMIT) return false
    this.sent.push(now)
    return true
  }
}
