import { describe, expect, it } from 'vitest'
import { circlesThatFit } from './use-fitting-circles'

/** Circles of 28px, each covering 6px of the one before: 22px per circle after the first. */
const CIRCLE = 28
/** The viewer's seat below the wide breakpoint: the size of any other circle. */
const VIEWER = 28

describe('circlesThatFit', () => {
  it('fits every circle when the rail has the room', () => {
    expect(
      circlesThatFit({
        width: 200,
        circleWidth: CIRCLE,
        viewerWidth: 0,
        seat: 'none',
        total: 5,
        hasExtra: false,
      })
    ).toBe(5)
  })

  it('folds what does not fit and keeps room for the +N label', () => {
    expect(
      circlesThatFit({
        width: 110,
        circleWidth: CIRCLE,
        viewerWidth: 0,
        seat: 'none',
        total: 5,
        hasExtra: false,
      })
    ).toBe(2)
  })

  it('counts the viewer seat as one more circle, overlapped by the next', () => {
    // 28 + 4 × 22 = 116 fits in 120.
    expect(
      circlesThatFit({
        width: 120,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'seated',
        total: 4,
        hasExtra: false,
      })
    ).toBe(4)
    // 116 does not fit in 110, which keeps 44px for the +N: the seat and one circle, 50px.
    expect(
      circlesThatFit({
        width: 110,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'seated',
        total: 4,
        hasExtra: false,
      })
    ).toBe(1)
  })

  it('keeps room for the +N of the seats past the rail', () => {
    // 200 - 22 - 44 = 134: the four circles take 94.
    expect(
      circlesThatFit({
        width: 200,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'seated',
        total: 4,
        hasExtra: true,
      })
    ).toBe(4)
    expect(
      circlesThatFit({
        width: 130,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'seated',
        total: 4,
        hasExtra: true,
      })
    ).toBe(2)
  })

  it('needs no room for the seat that opens on hover, as the last circle folds', () => {
    // Five circles take 116px at rest and on hover, when the seat opens (22) and the last folds (-22).
    expect(
      circlesThatFit({
        width: 115,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'on-hover',
        total: 5,
        hasExtra: false,
      })
    ).toBe(2)
    expect(
      circlesThatFit({
        width: 116,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'on-hover',
        total: 5,
        hasExtra: false,
      })
    ).toBe(5)
  })

  it('always shows one circle', () => {
    expect(
      circlesThatFit({
        width: 20,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'seated',
        total: 4,
        hasExtra: true,
      })
    ).toBe(1)
  })
})
