/** The slot meter's segment maths (admin Squads list review): the same length for every Squad size. */

import { describe, expect, it } from 'vitest'
import { computeSlotMeterFill } from './slot-meter-fill'

describe('computeSlotMeterFill', () => {
  it.each([
    [1, 1],
    [2, 2],
    [5, 5],
    [6, 5],
    [10, 5],
    [40, 5],
  ])('draws %i slots as %i segments', (total, segments) => {
    expect(computeSlotMeterFill(0, total).segments).toBe(segments)
  })

  it.each([1, 2, 5, 6, 10, 40])('lights nothing when nobody joined a %i-slot Squad', (total) => {
    expect(computeSlotMeterFill(0, total).lit).toBe(0)
  })

  it.each([1, 2, 5, 6, 10, 40])('lights everything only when a %i-slot Squad is full', (total) => {
    const { segments, lit } = computeSlotMeterFill(total, total)
    expect(lit).toBe(segments)
  })

  it.each([2, 5, 6, 10, 40])(
    'never looks empty with a member nor full with a free slot in a %i-slot Squad',
    (total) => {
      const { segments } = computeSlotMeterFill(0, total)
      for (let filled = 1; filled < total; filled += 1) {
        const { lit } = computeSlotMeterFill(filled, total)
        expect(lit).toBeGreaterThanOrEqual(1)
        expect(lit).toBeLessThanOrEqual(segments - 1)
      }
    }
  )

  it('keeps one segment per slot up to five slots', () => {
    expect(computeSlotMeterFill(3, 5).lit).toBe(3)
    expect(computeSlotMeterFill(1, 2).lit).toBe(1)
  })

  it('scales a bigger Squad proportionally', () => {
    expect(computeSlotMeterFill(31, 40).lit).toBe(4)
    expect(computeSlotMeterFill(20, 40).lit).toBe(3)
    expect(computeSlotMeterFill(5, 10).lit).toBe(3)
    expect(computeSlotMeterFill(3, 6).lit).toBe(3)
  })

  it('rounds the edges honestly', () => {
    expect(computeSlotMeterFill(1, 40).lit).toBe(1)
    expect(computeSlotMeterFill(39, 40).lit).toBe(4)
    expect(computeSlotMeterFill(40, 40).lit).toBe(5)
    expect(computeSlotMeterFill(5, 6).lit).toBe(4)
  })

  it('clamps out-of-range input', () => {
    expect(computeSlotMeterFill(-3, 10)).toEqual({ segments: 5, lit: 0 })
    expect(computeSlotMeterFill(99, 10)).toEqual({ segments: 5, lit: 5 })
    expect(computeSlotMeterFill(0, 0)).toEqual({ segments: 1, lit: 0 })
    expect(computeSlotMeterFill(3, 0)).toEqual({ segments: 1, lit: 1 })
  })
})
