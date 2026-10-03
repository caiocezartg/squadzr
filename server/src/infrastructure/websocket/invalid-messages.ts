import type { Clock } from '@domain/services/clock.interface'

export const INVALID_MESSAGE_WINDOW_MS = 60_000
export const INVALID_MESSAGE_LIMIT = 3

export class InvalidMessages {
  private attempts: number[] = []

  constructor(private readonly clock: Clock) {}

  record(): number {
    const now = this.clock.now().getTime()
    this.attempts = this.attempts.filter((at) => now - at <= INVALID_MESSAGE_WINDOW_MS)
    this.attempts.push(now)
    return this.attempts.length
  }
}
