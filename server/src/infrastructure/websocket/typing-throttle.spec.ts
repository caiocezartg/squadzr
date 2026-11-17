import { describe, expect, it } from 'vitest'
import { CHAT } from '@squadzr/schemas'
import { FakeClock } from '@test/harness/clock'
import { TypingThrottle } from './typing-throttle'

describe('TypingThrottle', () => {
  it('allows the first frame and refuses the ones within the throttle', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'))
    const throttle = new TypingThrottle(clock)

    expect(throttle.allow()).toBe(true)
    clock.advance(CHAT.TYPING_THROTTLE_MS - 1)
    expect(throttle.allow()).toBe(false)
  })

  it('allows a frame again once the throttle has passed', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'))
    const throttle = new TypingThrottle(clock)
    throttle.allow()

    clock.advance(CHAT.TYPING_THROTTLE_MS)

    expect(throttle.allow()).toBe(true)
  })

  it('measures from the last forwarded frame, so a dropped one never extends the wait', () => {
    const clock = new FakeClock(new Date('2026-01-01T00:00:00.000Z'))
    const throttle = new TypingThrottle(clock)
    throttle.allow()
    clock.advance(1_500)
    expect(throttle.allow()).toBe(false)

    clock.advance(500)

    expect(throttle.allow()).toBe(true)
  })
})
