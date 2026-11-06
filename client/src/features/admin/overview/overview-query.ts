import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import {
  ACTIVITY_METRICS,
  activityResponseSchema,
  DEFAULT_OVERVIEW_PERIOD,
  overviewPeriodQuerySchema,
  overviewResponseSchema,
  type ActivityMetric,
  type OverviewPeriod,
} from '@squadzr/schemas'
import { api } from '@/lib/api'

// The live numbers (online users above all) move on their own, so a page left open reads them again.
const OVERVIEW_REFETCH_MS = 30_000

/** The cache key of the Overview for one period. */
export function overviewQueryKey(period: OverviewPeriod) {
  return ['admin', 'overview', period] as const
}

/** The cache key of one metric's Activity series for one period. */
export function activityQueryKey(metric: ActivityMetric, period: OverviewPeriod) {
  return ['admin', 'activity', metric, period] as const
}

/**
 * The period a `?period=` value asks for, through the shared contract: an absent or invalid value is
 * the default period.
 */
export function overviewPeriodFrom(
  value: string | readonly string[] | null | undefined
): OverviewPeriod {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = overviewPeriodQuerySchema.safeParse(raw === undefined || raw === '' ? NaN : raw)
  return parsed.success ? parsed.data : DEFAULT_OVERVIEW_PERIOD
}

/**
 * The Overview of one period. A period the cache holds (the server's prefetch, an earlier visit)
 * renders at once; moving to one the cache lacks keeps the previous numbers on screen until the new
 * ones land, so the tiles never empty in between.
 */
export function useOverview(period: OverviewPeriod) {
  return useQuery({
    queryKey: overviewQueryKey(period),
    queryFn: () => api.get(`/api/admin/overview?period=${period}`, overviewResponseSchema),
    placeholderData: keepPreviousData,
    refetchInterval: OVERVIEW_REFETCH_MS,
  })
}

function activityQuery(metric: ActivityMetric, period: OverviewPeriod) {
  return {
    queryKey: activityQueryKey(metric, period),
    queryFn: () =>
      api.get(`/api/admin/activity?metric=${metric}&period=${period}`, activityResponseSchema),
  }
}

/**
 * One metric's per-day series. A new period keeps the previous series of the same metric on screen
 * until it lands; a different metric never borrows another metric's series, which would sit under the
 * wrong title.
 */
export function useActivity(metric: ActivityMetric, period: OverviewPeriod) {
  return useQuery({
    ...activityQuery(metric, period),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === metric ? previous : undefined,
  })
}

/**
 * Reads every metric's series of the period, so a tab the viewer switches to already has its data
 * (the same keys as `useActivity`, so nothing is read twice).
 */
export function useActivitySeriesOf(period: OverviewPeriod): void {
  useQueries({ queries: ACTIVITY_METRICS.map((metric) => activityQuery(metric, period)) })
}
