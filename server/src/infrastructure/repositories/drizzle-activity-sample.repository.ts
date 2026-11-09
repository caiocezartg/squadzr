import { and, gte, lt, max, sql } from 'drizzle-orm'
import type {
  ActivitySample,
  IActivitySampleRepository,
} from '@domain/repositories/activity-sample.repository'
import type { SampledActivityMetric } from '@domain/services/activity-period'
import type { Database } from '@infrastructure/database/drizzle'
import { activitySamples } from '@infrastructure/database/schema/activity-samples'

const DAY_FORMAT = 'YYYY-MM-DD'

export class DrizzleActivitySampleRepository implements IActivitySampleRepository {
  constructor(private readonly db: Database) {}

  async record(sample: ActivitySample): Promise<void> {
    await this.db.insert(activitySamples).values({
      sampledAt: sample.sampledAt,
      onlineUsers: sample.onlineUsers,
      openSquads: sample.openSquads,
    })
  }

  async peakByDay(
    metric: SampledActivityMetric,
    fromDay: string,
    toDay: string,
    timeZone: string
  ): Promise<Map<string, number>> {
    const day = sql<string>`to_char(${activitySamples.sampledAt} at time zone ${timeZone}, ${DAY_FORMAT})`
    const column = metric === 'online' ? activitySamples.onlineUsers : activitySamples.openSquads
    // The filter compares the raw instant against the zone's day boundaries, so the `sampled_at` index
    // serves it; the day expression stays in the select list and the grouping.
    const start = sql`(${fromDay}::date)::timestamp at time zone ${timeZone}`
    const end = sql`(${toDay}::date + 1)::timestamp at time zone ${timeZone}`
    const rows = await this.db
      .select({ day, peak: max(column) })
      .from(activitySamples)
      .where(and(gte(activitySamples.sampledAt, start), lt(activitySamples.sampledAt, end)))
      // Grouped by position: the day expression carries its zone as a parameter, which Postgres does
      // not match against the select list's copy of it.
      .groupBy(sql`1`)

    return new Map(rows.map((row) => [row.day, row.peak ?? 0]))
  }
}
