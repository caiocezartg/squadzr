import { describe, expect, it } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import { InvalidMessages } from './invalid-messages'

describe('invalid message rolling window', () => {
  it('counts attempts at the exact 60 second boundary and forgets older ones', () => {
    const clock = new FakeClock(new Date())
    const invalid = new InvalidMessages(clock)
    expect(invalid.record()).toBe(1)
    clock.advance(60_000)
    expect(invalid.record()).toBe(2)
    clock.advance(1)
    expect(invalid.record()).toBe(2)
    expect(invalid.record()).toBe(3)
  })
})
