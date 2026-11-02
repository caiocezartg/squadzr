import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMockupTimeline, type MockupMode } from './use-mockup-timeline'

const CUES = [100, 300, 600] as const

function renderTimeline(mode: MockupMode) {
  return renderHook(({ current }: { current: MockupMode }) => useMockupTimeline(CUES, current), {
    initialProps: { current: mode },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useMockupTimeline', () => {
  it('draws the last beat at once in final mode, and plays nothing', () => {
    const { result } = renderTimeline('final')

    expect(result.current).toEqual({ beat: CUES.length, live: false })
  })

  it('holds the first beat while waiting, then runs every beat once it plays', () => {
    const { result, rerender } = renderTimeline('waiting')
    expect(result.current).toEqual({ beat: 0, live: false })

    rerender({ current: 'play' })
    expect(result.current).toEqual({ beat: 0, live: true })

    act(() => vi.advanceTimersByTime(100))
    expect(result.current.beat).toBe(1)
    act(() => vi.advanceTimersByTime(200))
    expect(result.current.beat).toBe(2)
    act(() => vi.advanceTimersByTime(300))
    expect(result.current.beat).toBe(3)

    // It holds the last beat.
    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.beat).toBe(3)
  })

  it('starts at the last beat when it mounts already playing, so it never plays twice', () => {
    const { result } = renderTimeline('play')

    expect(result.current).toEqual({ beat: CUES.length, live: false })
    act(() => vi.advanceTimersByTime(5_000))
    expect(result.current.beat).toBe(CUES.length)
  })

  it('stops its beats when it unmounts mid-play', () => {
    const { result, rerender, unmount } = renderTimeline('waiting')
    rerender({ current: 'play' })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current.beat).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
