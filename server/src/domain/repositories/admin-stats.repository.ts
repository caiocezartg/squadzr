import type { CountedActivityMetric } from '@domain/services/activity-period'

/** The counts the admin Overview reads. */
export interface IAdminStatsRepository {
  /** Every registered user. */
  countUsers(): Promise<number>
  /** Open Squads that still count as open under the Squad Limits validity rule at `now`. */
  countOpenSquads(now: Date): Promise<number>
  /** Every Squad Record. */
  countCompletedSquads(): Promise<number>
  /**
   * How many times `metric` happened on each calendar day from `fromDay` to `toDay` inclusive, with
   * days in `timeZone`: Squad Records by Ready instant, users by creation. Days with none are absent.
   */
  countByDay(
    metric: CountedActivityMetric,
    fromDay: string,
    toDay: string,
    timeZone: string
  ): Promise<Map<string, number>>
}
