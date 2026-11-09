import { describe, expect, it } from 'vitest'
import {
  continuousSegments,
  dotPath,
  hasNoData,
  labelledIndexes,
  linePath,
  yStep,
} from './chart-scale'

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

  it('scales the y axis to the days with data, ignoring days without', () => {
    expect(yStep([row(null, 95), row(70, null)])).toBe(25)
  })

  it('splits a series into runs of consecutive days with data', () => {
    expect(continuousSegments([1, 2, null, null, 3, null, 4, 5])).toEqual([
      [
        { index: 0, value: 1 },
        { index: 1, value: 2 },
      ],
      [{ index: 4, value: 3 }],
      [
        { index: 6, value: 4 },
        { index: 7, value: 5 },
      ],
    ])
    expect(continuousSegments([null, null])).toEqual([])
    expect(continuousSegments([0])).toEqual([[{ index: 0, value: 0 }]])
  })

  it('breaks a line at a day with no value, never dropping it to zero', () => {
    expect(linePath([4, 4, null, 4, 4], 4)).toBe('M0.0 12.0 L250.0 12.0 M750.0 12.0 L1000.0 12.0')
    expect(linePath([null, null, null], 4)).toBe('')
  })

  it('marks a lone day between gaps as a dot rather than a line', () => {
    expect(linePath([4, null, 4], 4)).toBe('')
    expect(dotPath([4, null, 4], 4)).toBe('M0.0 12.0 h0 M1000.0 12.0 h0')
    expect(dotPath([4, 4, null], 4)).toBe('')
  })

  it('tells a pair of series with no data on any day', () => {
    expect(hasNoData([row(null, null), row(null, null)])).toBe(true)
    expect(hasNoData([row(null, 0)])).toBe(false)
  })

  it('labels every step back from the latest day', () => {
    expect(labelledIndexes(30, 7)).toEqual([1, 8, 15, 22, 29])
  })
})
