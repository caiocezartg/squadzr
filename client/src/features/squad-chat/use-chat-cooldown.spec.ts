import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT } from '@squadzr/schemas'
import { useChatCooldown } from './use-chat-cooldown'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function sendEvery(
  result: { current: ReturnType<typeof useChatCooldown> },
  gapMs: number,
  total: number
) {
  for (let n = 0; n < total; n++) {
    act(() => result.current.recordSend())
    if (n < total - 1) act(() => vi.advanceTimersByTime(gapMs))
  }
}

describe('useChatCooldown', () => {
  it('stays unlocked until the limit is filled', () => {
    const { result } = renderHook(() => useChatCooldown())

    sendEvery(result, 100, CHAT.RATE_LIMIT - 1)

    expect(result.current.cooldown).toBeNull()
    expect(result.current.isActive()).toBe(false)
  })

  it('starts on the message that fills the window and lasts until the oldest of them leaves it', () => {
    const { result } = renderHook(() => useChatCooldown())

    sendEvery(result, 1_000, CHAT.RATE_LIMIT)

    // Sent at 0s, 1s, 2s, 3s and 4s: the first leaves the window at 10s, 6s from now.
    expect(result.current.cooldown).toMatchObject({
      durationMs: 6_000,
      remainingMs: 6_000,
      remainingSeconds: 6,
    })
    expect(result.current.isActive()).toBe(true)
  })

  it('counts the seconds down, rounding up, and unlocks by itself', () => {
    const { result } = renderHook(() => useChatCooldown())
    sendEvery(result, 1_000, CHAT.RATE_LIMIT)

    act(() => vi.advanceTimersByTime(5_100))
    expect(result.current.cooldown?.remainingSeconds).toBe(1)

    act(() => vi.advanceTimersByTime(900))
    expect(result.current.cooldown).toBeNull()
    expect(result.current.isActive()).toBe(false)
  })

  it('does not count sends that already left the window', () => {
    const { result } = renderHook(() => useChatCooldown())

    // One send every 3s: a window never holds more than four.
    sendEvery(result, 3_000, CHAT.RATE_LIMIT * 2)

    expect(result.current.cooldown).toBeNull()
  })

  it('starts from the wait the server gave and keeps the longer of two cooldowns', () => {
    const { result } = renderHook(() => useChatCooldown())

    act(() => result.current.startFor(8_000))
    act(() => result.current.startFor(2_000))

    expect(result.current.cooldown).toMatchObject({ durationMs: 8_000, remainingSeconds: 8 })
  })

  it('clears the cooldown and forgets the sends counted', () => {
    const { result } = renderHook(() => useChatCooldown())
    sendEvery(result, 100, CHAT.RATE_LIMIT)
    expect(result.current.cooldown).not.toBeNull()

    act(() => result.current.clear())
    expect(result.current.cooldown).toBeNull()

    // Four more would fill the window only if the cleared ones were still counted.
    sendEvery(result, 100, CHAT.RATE_LIMIT - 1)
    expect(result.current.cooldown).toBeNull()
  })
})
