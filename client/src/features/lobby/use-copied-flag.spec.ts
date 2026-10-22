import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCopiedFlag } from './use-copied-flag'

describe('useCopiedFlag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the confirmation for two seconds after a copy', () => {
    const { result } = renderHook(() => useCopiedFlag())
    expect(result.current[0]).toBe(false)

    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)

    act(() => vi.advanceTimersByTime(1_999))
    expect(result.current[0]).toBe(true)

    act(() => vi.advanceTimersByTime(1))
    expect(result.current[0]).toBe(false)
  })

  it('restarts the two seconds when a second copy lands while the confirmation shows', () => {
    const { result } = renderHook(() => useCopiedFlag())

    act(() => result.current[1]())
    act(() => vi.advanceTimersByTime(1_500))
    act(() => result.current[1]())
    act(() => vi.advanceTimersByTime(1_500))
    expect(result.current[0]).toBe(true)

    act(() => vi.advanceTimersByTime(500))
    expect(result.current[0]).toBe(false)
  })

  it('clears its timer when the page unmounts', () => {
    const clearTimer = vi.spyOn(globalThis, 'clearTimeout')
    const { result, unmount } = renderHook(() => useCopiedFlag())
    act(() => result.current[1]())

    unmount()

    expect(clearTimer).toHaveBeenCalled()
  })
})
