import { describe, expect, it } from 'vitest'
import { isPeakMetric, seriesSummary } from './activity-summary'

describe('activity summary', () => {
  it('tells the sampled peak metrics from the counted ones', () => {
    expect(isPeakMetric('online')).toBe(true)
    expect(isPeakMetric('open')).toBe(true)
    expect(isPeakMetric('completed')).toBe(false)
    expect(isPeakMetric('signups')).toBe(false)
  })

  it('sums a counted metric over the period', () => {
    expect(seriesSummary('completed', [3, 4, 5])).toBe(12)
    expect(seriesSummary('signups', [])).toBe(0)
  })

  it('takes the highest day of a peak metric, skipping days with no data', () => {
    expect(seriesSummary('online', [12, null, 40, 7])).toBe(40)
    expect(seriesSummary('open', [null, 0, null])).toBe(0)
  })

  it('has no figure for a peak metric with no data on any day', () => {
    expect(seriesSummary('online', [null, null])).toBeNull()
    expect(seriesSummary('open', [])).toBeNull()
  })
})
