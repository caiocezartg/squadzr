import { between, count, sql, type SQL } from 'drizzle-orm'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import type { CountedActivityMetric } from '@domain/services/activity-period'
import type { Database } from '@infrastructure/database/drizzle'
import { user } from '@infrastructure/database/schema/auth'
import { rooms } from '@infrastructure/database/schema/rooms'
import { squadRecords } from '@infrastructure/database/schema/squad-records'
import { validOpenRoomCondition } from './open-room-rules'

const DAY_FORMAT = 'YYYY-MM-DD'

/** The calendar day in `timeZone` of a `timestamptz` column. */
function localDay(column: SQL | typeof squadRecords.readyAt, timeZone: string): SQL<string> {
  return sql<string>`to_char(${column} at time zone ${timeZone}, ${DAY_FORMAT})`
}

/**
 * The calendar day in `timeZone` of the user's creation. `user.created_at` is a `timestamp` without a
 * zone that holds a UTC wall clock, so it is read as UTC before it moves to `timeZone`.
 */
function signupDay(timeZone: string): SQL<string> {
  return localDay(sql`(${user.createdAt} at time zone 'UTC')`, timeZone)
}

export class DrizzleAdminStatsRepository implements IAdminStatsRepository {
  constructor(private readonly db: Database) {}

  async countUsers(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(user)

    return row?.total ?? 0
  }

  async countOpenSquads(now: Date): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(rooms)
      .where(validOpenRoomCondition(now))

    return row?.total ?? 0
  }

  async countCompletedSquads(): Promise<number> {
    const [row] = await this.db.select({ total: count() }).from(squadRecords)

    return row?.total ?? 0
  }

  async countByDay(
    metric: CountedActivityMetric,
    fromDay: string,
    toDay: string,
    timeZone: string
  ): Promise<Map<string, number>> {
    const day =
      metric === 'completed' ? localDay(squadRecords.readyAt, timeZone) : signupDay(timeZone)
    const query = this.db.select({ day, total: count() })
    const rows = await (metric === 'completed' ? query.from(squadRecords) : query.from(user))
      .where(between(day, fromDay, toDay))
      // Grouped by position: the day expression carries its zone as a parameter, which Postgres does
      // not match against the select list's copy of it.
      .groupBy(sql`1`)

    return new Map(rows.map((row) => [row.day, row.total]))
  }
}
