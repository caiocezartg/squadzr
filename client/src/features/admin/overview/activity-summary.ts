import type { ActivityMetric } from '@squadzr/schemas'

// The metrics read from Activity Samples: a day is its highest sample, and the period its highest day.
const PEAK_METRICS: ReadonlySet<ActivityMetric> = new Set<ActivityMetric>(['online', 'open'])

/** Whether a metric is a sampled peak (summed up by its highest day) rather than a daily count. */
export function isPeakMetric(metric: ActivityMetric): boolean {
  return PEAK_METRICS.has(metric)
}

/**
 * A series' figure for the period: the sum of a counted metric's days, or a peak metric's highest day.
 * `null` is a peak series with no data on any day, which is not a peak of 0.
 */
export function seriesSummary(
  metric: ActivityMetric,
  values: readonly (number | null)[]
): number | null {
  if (!isPeakMetric(metric)) return values.reduce<number>((sum, value) => sum + (value ?? 0), 0)

  const known = values.filter((value): value is number => value !== null)
  return known.length === 0 ? null : Math.max(...known)
}
