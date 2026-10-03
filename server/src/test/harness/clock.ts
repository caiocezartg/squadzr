import type { Clock } from '@domain/services/clock.interface'

/** Mutable clock for deterministic integration tests; every read returns a copy. */
export class FakeClock implements Clock {
  private current: Date

  constructor(instant: Date) {
    this.current = new Date(instant)
  }

  now(): Date {
    return new Date(this.current)
  }

  set(instant: Date): void {
    this.current = new Date(instant)
  }

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms)
  }
}

/**
 * Clock that advances one millisecond on every read. Concurrent operations
 * that read it after their lock therefore receive distinct, increasing
 * instants; a read before the lock would hand them the same stale value.
 */
export class TickingClock implements Clock {
  private calls = 0

  constructor(private readonly base: Date) {}

  now(): Date {
    this.calls += 1
    return new Date(this.base.getTime() + this.calls)
  }
}
