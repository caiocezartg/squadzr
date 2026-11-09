import type { ActivityMetric, OverviewPeriod } from '@squadzr/schemas'
import type { IActivitySampleRepository } from '@domain/repositories/activity-sample.repository'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import {
  buildCountedRows,
  buildSampledRows,
  calendarDayOf,
  isSampledMetric,
  periodDays,
  type ActivityRow,
} from '@domain/services/activity-period'
import type { Clock } from '@domain/services/clock.interface'

export interface GetAdminActivityInput {
  readonly metric: ActivityMetric
  readonly period: OverviewPeriod
  /** The instant the period ends at; the clock is read when omitted. */
  readonly now?: Date
}

export interface GetAdminActivityOutput {
  readonly metric: ActivityMetric
  readonly period: OverviewPeriod
  /** Exactly `period` rows, oldest first. */
  readonly rows: ActivityRow[]
}

export interface IGetAdminActivityUseCase {
  execute(input: GetAdminActivityInput): Promise<GetAdminActivityOutput>
}

/**
 * The Activity chart's series: each day of the period beside the same day of the previous one. A
 * counted metric (completed Squads, sign-ups) is 0 on a quiet day; a sampled one (peak online, peak
 * Open Squads) is null on a day without Activity Samples.
 */
export class GetAdminActivityUseCase implements IGetAdminActivityUseCase {
  constructor(
    private readonly statsRepository: IAdminStatsRepository,
    private readonly clock: Clock,
    private readonly timeZone: string,
    private readonly activitySamples: IActivitySampleRepository
  ) {}

  async execute(input: GetAdminActivityInput): Promise<GetAdminActivityOutput> {
    const days = periodDays(
      calendarDayOf(input.now ?? this.clock.now(), this.timeZone),
      input.period
    )
    const fromDay = days.previous[0] ?? ''
    const toDay = days.current[days.current.length - 1] ?? ''
    const { metric, period } = input

    if (isSampledMetric(metric)) {
      const peaks = await this.activitySamples.peakByDay(metric, fromDay, toDay, this.timeZone)

      return { metric, period, rows: buildSampledRows(days, peaks) }
    }

    const counts = await this.statsRepository.countByDay(metric, fromDay, toDay, this.timeZone)

    return { metric, period, rows: buildCountedRows(days, counts) }
  }
}
