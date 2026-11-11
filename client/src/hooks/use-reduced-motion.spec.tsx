/**
 * The reduced-motion preference the scripted animations read: it answers the
 * viewer's `prefers-reduced-motion` setting and follows it when it changes.
 */

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockMediaQuery } from '@/test/media-query'
import { useReducedMotion } from './use-reduced-motion'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useReducedMotion', () => {
  it('is false when the viewer has no reduced-motion preference', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)

    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(false)
  })

  it('is true when the viewer prefers reduced motion', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, true)

    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(true)
  })

  it('follows the preference when it changes while the page is open', () => {
    const preference = mockMediaQuery(REDUCED_MOTION_QUERY, false)
    const { result } = renderHook(() => useReducedMotion())

    act(() => {
      preference.set(true)
    })
    expect(result.current).toBe(true)

    act(() => {
      preference.set(false)
    })
    expect(result.current).toBe(false)
  })
})
