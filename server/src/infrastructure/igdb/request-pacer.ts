import type { Clock } from '@domain/services/clock.interface'

/** IGDB allows at most 4 requests per second. */
export const MIN_REQUEST_INTERVAL_MS = 250

export type Sleep = (ms: number) => Promise<void>

export const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Spaces requests at least `intervalMs` apart, measured with the injected
 * clock. The sleep is injected so tests advance the clock instead of waiting.
 */
export class RequestPacer {
  private lastRequestAt: number | null = null

  constructor(
    private readonly clock: Clock,
    private readonly sleep: Sleep = defaultSleep,
    private readonly intervalMs: number = MIN_REQUEST_INTERVAL_MS
  ) {}

  async waitTurn(): Promise<void> {
    if (this.lastRequestAt !== null) {
      const elapsed = this.clock.now().getTime() - this.lastRequestAt
      if (elapsed < this.intervalMs) await this.sleep(this.intervalMs - elapsed)
    }

    this.lastRequestAt = this.clock.now().getTime()
  }
}
