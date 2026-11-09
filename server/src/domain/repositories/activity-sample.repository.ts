import type { SampledActivityMetric } from '@domain/services/activity-period'

/** One reading of the platform: how many people were online and how many Squads open at an instant. */
export interface ActivitySample {
  readonly sampledAt: Date
  readonly onlineUsers: number
  readonly openSquads: number
}

/** The Activity Samples the sampler writes and the admin Overview reads. They are kept indefinitely. */
export interface IActivitySampleRepository {
  record(sample: ActivitySample): Promise<void>
  /**
   * The highest `metric` of the samples of each calendar day from `fromDay` to `toDay` inclusive, with
   * days in `timeZone`. Days without a sample are absent.
   */
  peakByDay(
    metric: SampledActivityMetric,
    fromDay: string,
    toDay: string,
    timeZone: string
  ): Promise<Map<string, number>>
}
