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
