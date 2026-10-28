import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useReadyEntrance } from './use-ready-entrance'

interface Frame {
  hasSnapshot: boolean
  isReady: boolean
}

function renderEntrance(initial: Frame) {
  return renderHook((frame: Frame) => useReadyEntrance(frame.hasSnapshot, frame.isReady), {
    initialProps: initial,
  })
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

  it('forgets what it watched when the channel resets, so the next Squad starts from its first snapshot', () => {
    const { result, rerender } = renderEntrance({ hasSnapshot: true, isReady: false })

    rerender({ hasSnapshot: false, isReady: false })
    rerender({ hasSnapshot: true, isReady: true })

    expect(result.current).toBe(false)
  })
})
