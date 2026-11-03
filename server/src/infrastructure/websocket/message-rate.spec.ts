import { describe, expect, it } from 'vitest'
import { FakeClock } from '@test/harness/clock'
import { MessageRate, MESSAGE_RATE_LIMIT } from './message-rate'

describe('MessageRate', () => {
  it('allows the limit within one window and refuses the next message', () => {
    const rate = new MessageRate(new FakeClock(new Date('2026-01-01T00:00:00.000Z')))

    for (let i = 0; i < MESSAGE_RATE_LIMIT; i++) expect(rate.allow()).toBe(true)
    expect(rate.allow()).toBe(false)
  })

  it('allows again once the window has passed', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'))
    const rate = new MessageRate(clock)
    for (let i = 0; i < MESSAGE_RATE_LIMIT; i++) rate.allow()

    clock.advance(10_000)

    expect(rate.allow()).toBe(true)
  })

  it('does not count a refused message against the next window', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'))
    const rate = new MessageRate(clock)
    for (let i = 0; i < MESSAGE_RATE_LIMIT; i++) rate.allow()
    clock.advance(5_000)
    for (let i = 0; i < 10; i++) expect(rate.allow()).toBe(false)

    clock.advance(5_000)

    expect(rate.allow()).toBe(true)
  })
})
