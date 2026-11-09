import { describe, expect, it } from 'vitest'
import { runDuration } from './run-duration'

const START = '2026-11-08T04:00:00.000Z'

describe('runDuration', () => {
  it('is null until the run has started and finished', () => {
    expect(runDuration(null, null)).toBeNull()
    expect(runDuration(START, null)).toBeNull()
  })

  it('reads under a minute in seconds, rounded down', () => {
    expect(runDuration(START, '2026-11-08T04:00:14.900Z')).toEqual({ unit: 'seconds', seconds: 14 })
  })

  it('reads under an hour in minutes and seconds', () => {
    expect(runDuration(START, '2026-11-08T04:03:12.000Z')).toEqual({
      unit: 'minutes',
      minutes: 3,
      seconds: 12,
    })
  })

  it('reads an hour or more in hours and minutes', () => {
    expect(runDuration(START, '2026-11-08T05:02:59.000Z')).toEqual({
      unit: 'hours',
      hours: 1,
      minutes: 2,
    })
  })

  it('reads an end before the start as zero', () => {
    expect(runDuration(START, '2026-11-08T03:59:00.000Z')).toEqual({ unit: 'seconds', seconds: 0 })
  })
})
