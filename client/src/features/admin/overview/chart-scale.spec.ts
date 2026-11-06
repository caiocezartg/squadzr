import { describe, expect, it } from 'vitest'
import { labelledIndexes, linePath, yStep } from './chart-scale'

const row = (current: number | null, previous: number | null) => ({
  date: '2026-11-05',
  current,
  previous,
})

describe('chart scale', () => {
  it('steps the y axis in round whole numbers above the highest value', () => {
    expect(yStep([row(70, 95)])).toBe(25)
    expect(yStep([row(3, 1)])).toBe(1)
    expect(yStep([row(0, 0)])).toBe(1)
    expect(yStep([row(null, null)])).toBe(1)
  })

  it('breaks a line at a day with no value', () => {
    expect(linePath([4, null, 4], 4)).toBe('M0.0 12.0 M1000.0 12.0')
  })

  it('labels every step back from the latest day', () => {
    expect(labelledIndexes(30, 7)).toEqual([1, 8, 15, 22, 29])
  })
})
