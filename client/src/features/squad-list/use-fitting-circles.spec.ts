import { describe, expect, it } from 'vitest'
import { circlesThatFit } from './use-fitting-circles'

/** Circles of 28px, each covering 6px of the one before: 22px per circle after the first. */
const CIRCLE = 28
/** The viewer's seat below the wide breakpoint. */
const VIEWER = 34

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

  it('counts the viewer seat as its own width before the other circles', () => {
    // 34 + 28 + 3 × 22 = 128 fits in 150.
    expect(
      circlesThatFit({
        width: 150,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'seated',
        total: 4,
        hasExtra: false,
      })
    ).toBe(4)
    // In 110 only 34 + 28 + 22 = 84 fits, with 44px left for the +N.
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
    // 200 - 34 - 44 = 122: the four circles take 94.
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

  it('leaves room for the seat that opens on hover while the last circle folds', () => {
    // At rest five circles take 116px, but on hover the seat opens (34) and the last folds (-22): 128.
    expect(
      circlesThatFit({
        width: 120,
        circleWidth: CIRCLE,
        viewerWidth: VIEWER,
        seat: 'on-hover',
        total: 5,
        hasExtra: false,
      })
    ).toBe(2)
    expect(
      circlesThatFit({
        width: 128,
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
