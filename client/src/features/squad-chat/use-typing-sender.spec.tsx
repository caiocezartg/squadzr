import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CHAT } from '@squadzr/schemas'
import { useTypingSender } from './use-typing-sender'

const CODE = 'abc123'

type SenderProps = { enabled: boolean; isReady: boolean; status?: 'open' | 'reconnecting' }

function renderSender(
  options: SenderProps = { enabled: true, isReady: false },
  membershipRevoked = false
) {
  const notifyTyping = vi.fn<(squadCode: string) => void>()
  const view = renderHook(
    ({ status = 'open', ...props }: SenderProps) =>
      useTypingSender(CODE, { status, notifyTyping, membershipRevoked }, props),
    { initialProps: options }
  )
  return { ...view, notifyTyping }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useTypingSender', () => {
  it('signals the first change at once, for the uppercased Squad', () => {
    const { result, notifyTyping } = renderSender()

    result.current('o')

    expect(notifyTyping).toHaveBeenCalledTimes(1)
    expect(notifyTyping).toHaveBeenCalledWith('ABC123')
  })

  it('signals at most once per throttle however often the text changes', () => {
    const { result, notifyTyping } = renderSender()

    for (const draft of ['o', 'oi', 'oi ', 'oi t']) result.current(draft)
    expect(notifyTyping).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(CHAT.TYPING_THROTTLE_MS - 1)
    result.current('oi ti')
    expect(notifyTyping).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1)
    result.current('oi tim')
    expect(notifyTyping).toHaveBeenCalledTimes(2)
  })

  it('measures from the last signal sent, so changes the throttle dropped never extend the wait', () => {
    const { result, notifyTyping } = renderSender()
    result.current('a')
    vi.advanceTimersByTime(1_500)
    result.current('ab')

    vi.advanceTimersByTime(500)
    result.current('abc')

    expect(notifyTyping).toHaveBeenCalledTimes(2)
  })

  it('signals nothing for an empty or blank text, and does not spend the throttle on it', () => {
    const { result, notifyTyping } = renderSender()

    result.current('')
    result.current('   \n')
    expect(notifyTyping).not.toHaveBeenCalled()

    result.current('a')
    expect(notifyTyping).toHaveBeenCalledTimes(1)
  })

  it('signals nothing while the Squad is Ready', () => {
    const { result, notifyTyping } = renderSender({ enabled: true, isReady: true })

    result.current('oi')

    expect(notifyTyping).not.toHaveBeenCalled()
  })

  it('signals nothing for a viewer who is not a member, or whose Membership was revoked', () => {
    const outsider = renderSender({ enabled: false, isReady: false })
    outsider.result.current('oi')
    const revoked = renderSender({ enabled: true, isReady: false }, true)
    revoked.result.current('oi')

    expect(outsider.notifyTyping).not.toHaveBeenCalled()
    expect(revoked.notifyTyping).not.toHaveBeenCalled()
  })

  it('signals nothing while the socket is down, and the lost change does not use up the throttle', () => {
    const { result, rerender, notifyTyping } = renderSender({
      enabled: true,
      isReady: false,
      status: 'reconnecting',
    })
    result.current('oi')
    expect(notifyTyping).not.toHaveBeenCalled()

    // Back up within the same throttle window: the change lost while down did not spend it.
    rerender({ enabled: true, isReady: false, status: 'open' })
    result.current('oi')
    expect(notifyTyping).toHaveBeenCalledTimes(1)
  })

  it('starts signalling again once the Squad stops being Ready', () => {
    const { result, rerender, notifyTyping } = renderSender({ enabled: true, isReady: true })
    result.current('oi')

    rerender({ enabled: true, isReady: false })
    result.current('oi')

    expect(notifyTyping).toHaveBeenCalledTimes(1)
  })
})
