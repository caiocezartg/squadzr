import { z } from 'zod'
import { auditEntrySchema } from './admin'

// The admin panel's Overview contracts (#120). Later tickets add to them without breaking a client:
// a metric joins `ACTIVITY_METRICS` and the `metrics` map (#121 added peak online and peak Open Squads),
// and a field joins the overview object (the last Catalog Import Run).

/** The periods the Overview compares, in days. */
export const OVERVIEW_PERIODS = [7, 30, 90] as const

export const overviewPeriodSchema = z.union([z.literal(7), z.literal(30), z.literal(90)])

export type OverviewPeriod = z.infer<typeof overviewPeriodSchema>

// A period travels as `?period=7|30|90`; the query string is text, so it is coerced.
export const overviewPeriodQuerySchema = z.coerce.number().pipe(overviewPeriodSchema)

/** The Overview's default period. */
export const DEFAULT_OVERVIEW_PERIOD: OverviewPeriod = 30

/** How many audit entries the Overview lists. */
export const OVERVIEW_AUDIT_LIMIT = 5

export const overviewQuerySchema = z.object({
  period: overviewPeriodQuerySchema.default(DEFAULT_OVERVIEW_PERIOD),
})

export type OverviewQuery = z.infer<typeof overviewQuerySchema>

/** The metrics the Activity chart plots. */
export const ACTIVITY_METRICS = ['completed', 'signups', 'online', 'open'] as const

export const activityMetricSchema = z.enum(ACTIVITY_METRICS)

export type ActivityMetric = z.infer<typeof activityMetricSchema>

export const activityQuerySchema = z.object({
  metric: activityMetricSchema,
  period: overviewPeriodQuerySchema.default(DEFAULT_OVERVIEW_PERIOD),
})

export type ActivityQuery = z.infer<typeof activityQuerySchema>

// A day of the series, as `YYYY-MM-DD` in the panel's time zone (`America/Sao_Paulo`).
export const calendarDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

// `null` is a day with no data (a sampled metric before its sampler ran); a counted day is a number.
const dayValueSchema = z.number().int().nonnegative().nullable()

/** One day of the Activity chart: the same day of the period and of the one before it. */
export const activityRowSchema = z.object({
  date: calendarDaySchema,
  current: dayValueSchema,
  previous: dayValueSchema,
})

export type ActivityRowDto = z.infer<typeof activityRowSchema>

/** Exactly `period` rows, oldest first. `previous` is the day `period` days earlier. */
export const activityResponseSchema = z.object({
  metric: activityMetricSchema,
  period: overviewPeriodSchema,
  rows: z.array(activityRowSchema),
})

export type ActivityResponse = z.infer<typeof activityResponseSchema>

/** A metric's total for the chosen period and for the one of the same length before it. */
export const periodComparisonSchema = z.object({
  current: z.number().int().nonnegative(),
  previous: z.number().int().nonnegative(),
})

export type PeriodComparisonDto = z.infer<typeof periodComparisonSchema>

/**
 * A sampled metric's peak for the chosen period and for the one before it. `null` is a period with no
 * Activity Samples (the sampler had not run yet), which is not the same as a peak of 0.
 */
export const peakComparisonSchema = z.object({
  current: z.number().int().nonnegative().nullable(),
  previous: z.number().int().nonnegative().nullable(),
})

export type PeakComparisonDto = z.infer<typeof peakComparisonSchema>

export const overviewLiveSchema = z.object({
  onlineUsers: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  openSquads: z.number().int().nonnegative(),
  completedSquads: z.number().int().nonnegative(),
})

export type OverviewLiveDto = z.infer<typeof overviewLiveSchema>

// `recentAudit` is the latest entries for an admin or the owner and null for a moderator, who may not
// read the audit.
export const overviewResponseSchema = z.object({
  period: overviewPeriodSchema,
  live: overviewLiveSchema,
  metrics: z.object({
    completed: periodComparisonSchema,
    signups: periodComparisonSchema,
    online: peakComparisonSchema,
    open: peakComparisonSchema,
  }),
  recentAudit: z.array(auditEntrySchema).nullable(),
})

export type OverviewResponse = z.infer<typeof overviewResponseSchema>
