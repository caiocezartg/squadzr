import type { ActivityMetric, OverviewPeriod } from '@squadzr/schemas'

/** The metrics counted from events (a day nothing happened on is 0). */
export type CountedActivityMetric = Extract<ActivityMetric, 'completed' | 'signups'>

/** The metrics read from Activity Samples (a day without samples has no data, which is not 0). */
export type SampledActivityMetric = Extract<ActivityMetric, 'online' | 'open'>

export function isSampledMetric(metric: ActivityMetric): metric is SampledActivityMetric {
  return metric === 'online' || metric === 'open'
}

/** One day of an Activity series. `null` is a day with no data. */
export interface ActivityRow {
  readonly date: string
  readonly current: number | null
  readonly previous: number | null
}

export interface PeriodTotals {
  readonly current: number
  readonly previous: number
}

const MS_PER_DAY = 24 * 60 * 60_000

/** The calendar day (`YYYY-MM-DD`) an instant falls on in `timeZone`. */
export function calendarDayOf(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? ''

  return `${part('year')}-${part('month')}-${part('day')}`
}

/** `day` moved by `delta` calendar days. Pure calendar arithmetic: a day has no time zone. */
export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + delta * MS_PER_DAY)
    .toISOString()
    .slice(0, 10)
}

export interface PeriodDays {
  /** The `period` days ending on `today`, oldest first. */
  readonly current: string[]
  /** The `period` days right before them, oldest first. */
  readonly previous: string[]
}

export function periodDays(today: string, period: OverviewPeriod): PeriodDays {
  const current = Array.from({ length: period }, (_, index) => addDays(today, index + 1 - period))
  const previous = current.map((day) => addDays(day, -period))

  return { current, previous }
}

/**
 * The series of a counted metric: one row per day of the current period, with the same day of the
 * previous one. A day nothing happened on is 0, never null.
 */
export function buildCountedRows(
  days: PeriodDays,
  counts: ReadonlyMap<string, number>
): ActivityRow[] {
  return days.current.map((date, index) => ({
    date,
    current: counts.get(date) ?? 0,
    previous: counts.get(days.previous[index] ?? '') ?? 0,
  }))
}

/** What a series adds up to over the period and over the one before it. */
export function totalPeriods(rows: readonly ActivityRow[]): PeriodTotals {
  return rows.reduce<PeriodTotals>(
    (totals, row) => ({
      current: totals.current + (row.current ?? 0),
      previous: totals.previous + (row.previous ?? 0),
    }),
    { current: 0, previous: 0 }
  )
}

/**
 * The series of a sampled metric: the peak of each day of the period beside the same day of the
 * previous one. A day with no Activity Sample is null, never 0.
 */
export function buildSampledRows(
  days: PeriodDays,
  peaks: ReadonlyMap<string, number>
): ActivityRow[] {
  return days.current.map((date, index) => ({
    date,
    current: peaks.get(date) ?? null,
    previous: peaks.get(days.previous[index] ?? '') ?? null,
  }))
}

export interface PeriodPeaks {
  readonly current: number | null
  readonly previous: number | null
}

function peakOf(values: readonly (number | null)[]): number | null {
  return values.reduce<number | null>(
    (peak, value) => (value === null ? peak : Math.max(peak ?? value, value)),
    null
  )
}

/** The highest day of a sampled series over the period and over the one before it; null with no data. */
export function peakPeriods(rows: readonly ActivityRow[]): PeriodPeaks {
  return {
    current: peakOf(rows.map((row) => row.current)),
    previous: peakOf(rows.map((row) => row.previous)),
  }
}
