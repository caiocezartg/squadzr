import type { ActivityMetric, OverviewPeriod } from '@squadzr/schemas'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import {
  buildCountedRows,
  calendarDayOf,
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

/** The Activity chart's series: each day of the period beside the same day of the previous one. */
export class GetAdminActivityUseCase implements IGetAdminActivityUseCase {
  constructor(
    private readonly statsRepository: IAdminStatsRepository,
    private readonly clock: Clock,
    private readonly timeZone: string
  ) {}

  async execute(input: GetAdminActivityInput): Promise<GetAdminActivityOutput> {
    const days = periodDays(
      calendarDayOf(input.now ?? this.clock.now(), this.timeZone),
      input.period
    )
    const counts = await this.statsRepository.countByDay(
      input.metric,
      days.previous[0] ?? '',
      days.current[days.current.length - 1] ?? '',
      this.timeZone
    )

    return { metric: input.metric, period: input.period, rows: buildCountedRows(days, counts) }
  }
}
