import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useReadyEntrance } from './use-ready-entrance'

interface Frame {
  squadCode?: string
  hasSnapshot: boolean
  isReady: boolean
  /** The viewer is looking at the Squad from outside it: the non-member view. */
  isOutside?: boolean
}

function renderEntrance(initial: Frame) {
  return renderHook(
    (frame: Frame) =>
      useReadyEntrance({
        squadCode: frame.squadCode ?? 'LOBBY1',
        hasSnapshot: frame.hasSnapshot,
        isReady: frame.isReady,
        isOutside: frame.isOutside ?? false,
      }),
    { initialProps: initial }
  )
}

describe('useReadyEntrance', () => {
  it('enters the panel when the viewer watched the Squad form and then complete', () => {
    const { result, rerender } = renderEntrance({ hasSnapshot: false, isReady: false })
    expect(result.current).toBe(false)

    rerender({ hasSnapshot: true, isReady: false })
    expect(result.current).toBe(false)

    rerender({ hasSnapshot: true, isReady: true })
    expect(result.current).toBe(true)
  })

  it('does not enter the panel of a Squad that is Ready in the first snapshot, as on a reload', () => {
    const { result, rerender } = renderEntrance({ hasSnapshot: false, isReady: false })

    rerender({ hasSnapshot: true, isReady: true })

    expect(result.current).toBe(false)
  })

  it('enters the panel of the viewer whose join closed the last slot: the first snapshot they get is Ready', () => {
    // The viewer watched the Squad from outside, joined, and the join made it Ready.
    const { result, rerender } = renderEntrance({
      hasSnapshot: false,
      isReady: false,
      isOutside: true,
    })
    expect(result.current).toBe(false)

    rerender({ hasSnapshot: false, isReady: false, isOutside: false })
    rerender({ hasSnapshot: true, isReady: true, isOutside: false })

    expect(result.current).toBe(true)
  })

  it('does not count another Squad the viewer watched from outside', () => {
    const { result, rerender } = renderEntrance({
      squadCode: 'OTHER1',
      hasSnapshot: false,
      isReady: false,
      isOutside: true,
    })

    rerender({ squadCode: 'LOBBY1', hasSnapshot: true, isReady: true, isOutside: false })

    expect(result.current).toBe(false)
  })

  it('forgets what it watched when the channel resets, so the next Squad starts from its first snapshot', () => {
    const { result, rerender } = renderEntrance({ hasSnapshot: true, isReady: false })

    rerender({ hasSnapshot: false, isReady: false })
    rerender({ hasSnapshot: true, isReady: true })

    expect(result.current).toBe(false)
  })
})
