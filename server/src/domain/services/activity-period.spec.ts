import { describe, expect, it } from 'vitest'
import {
  addDays,
  buildCountedRows,
  buildSampledRows,
  calendarDayOf,
  peakPeriods,
  periodDays,
  totalPeriods,
} from './activity-period'

const SAO_PAULO = 'America/Sao_Paulo'

describe('calendarDayOf', () => {
  it('keeps 02:59 UTC on the previous Sao Paulo day and 03:00 UTC on the next', () => {
    expect(calendarDayOf(new Date('2026-11-05T02:59:59.999Z'), SAO_PAULO)).toBe('2026-11-04')
    expect(calendarDayOf(new Date('2026-11-05T03:00:00.000Z'), SAO_PAULO)).toBe('2026-11-05')
  })

  it('crosses a year boundary on the local calendar', () => {
    expect(calendarDayOf(new Date('2027-01-01T01:00:00.000Z'), SAO_PAULO)).toBe('2026-12-31')
  })
})

describe('addDays', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('periodDays', () => {
  it('lists the period ending today and the same number of days before it, oldest first', () => {
    const days = periodDays('2026-11-05', 7)

    expect(days.current).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
    ])
    expect(days.previous[0]).toBe('2026-10-23')
    expect(days.previous[6]).toBe('2026-10-29')
  })

  it.each([7, 30, 90] as const)('has exactly %i days on both sides', (period) => {
    const days = periodDays('2026-11-05', period)

    expect(days.current).toHaveLength(period)
    expect(days.previous).toHaveLength(period)
  })
})

describe('buildCountedRows and totalPeriods', () => {
  const days = periodDays('2026-11-05', 7)
  const counts = new Map([
    ['2026-11-05', 3],
    ['2026-10-30', 1],
    ['2026-10-29', 4],
    ['2026-10-23', 2],
    ['2026-10-01', 99],
  ])

  it('pairs each day with the day a period earlier and fills empty days with 0', () => {
    const rows = buildCountedRows(days, counts)

    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual({ date: '2026-10-30', current: 1, previous: 2 })
    expect(rows[1]).toEqual({ date: '2026-10-31', current: 0, previous: 0 })
    expect(rows[6]).toEqual({ date: '2026-11-05', current: 3, previous: 4 })
  })

  it('adds the rows of each period, leaving out days outside both', () => {
    expect(totalPeriods(buildCountedRows(days, counts))).toEqual({ current: 4, previous: 6 })
  })

  it('treats days without data as 0 in a total', () => {
    expect(
      totalPeriods([
        { date: '2026-11-04', current: null, previous: 2 },
        { date: '2026-11-05', current: 5, previous: null },
      ])
    ).toEqual({ current: 5, previous: 2 })
  })
})

describe('buildSampledRows and peakPeriods', () => {
  const days = periodDays('2026-11-05', 7)
  const peaks = new Map([
    ['2026-11-05', 12],
    ['2026-11-03', 0],
    ['2026-10-29', 30],
    ['2026-10-01', 99],
  ])

  it('leaves a day without samples null, never 0', () => {
    const rows = buildSampledRows(days, peaks)

    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual({ date: '2026-10-30', current: null, previous: null })
    expect(rows[4]).toEqual({ date: '2026-11-03', current: 0, previous: null })
    expect(rows[6]).toEqual({ date: '2026-11-05', current: 12, previous: 30 })
  })

  it('takes the highest day of each period and keeps a peak of 0 apart from no data', () => {
    expect(peakPeriods(buildSampledRows(days, peaks))).toEqual({ current: 12, previous: 30 })
    expect(peakPeriods(buildSampledRows(days, new Map([['2026-11-03', 0]])))).toEqual({
      current: 0,
      previous: null,
    })
  })

  it('has no peak when no day has data', () => {
    expect(peakPeriods(buildSampledRows(days, new Map()))).toEqual({
      current: null,
      previous: null,
    })
  })
})
