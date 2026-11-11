import type { Clock } from '@domain/services/clock.interface'

/** Production clock: the only place `new Date()` is read for lifecycle decisions. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date()
  }
}
