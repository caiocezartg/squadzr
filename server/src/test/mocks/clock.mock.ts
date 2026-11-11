import { vi, type Mock } from 'vitest'
import type { Clock } from '@domain/services/clock.interface'

export const FIXED_NOW = new Date('2026-01-01T00:00:00.000Z')

export interface MockClock extends Clock {
  now: Mock<() => Date>
  set: (instant: Date) => void
}

/** Deterministic clock: every `now()` returns a copy of the current instant. */
export function createMockClock(instant: Date = FIXED_NOW): MockClock {
  let current = instant
  return {
    now: vi.fn(() => new Date(current)),
    set: (next: Date) => {
      current = next
    },
  }
}
