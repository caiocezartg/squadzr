import type { IActivitySampleRepository } from '@domain/repositories/activity-sample.repository'
import type { IAdminStatsRepository } from '@domain/repositories/admin-stats.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { OnlinePresence } from '@domain/services/online-presence.interface'

export interface IRunActivitySampleUseCase {
  execute(): Promise<void>
}

/** One reading of the platform: the people online and the Open Squads right now, stored as one Activity Sample. */
export class RunActivitySampleUseCase implements IRunActivitySampleUseCase {
  constructor(
    private readonly onlinePresence: OnlinePresence,
    private readonly statsRepository: IAdminStatsRepository,
    private readonly activitySamples: IActivitySampleRepository,
    private readonly clock: Clock
  ) {}

  async execute(): Promise<void> {
    const sampledAt = this.clock.now()
    const openSquads = await this.statsRepository.countOpenSquads(sampledAt)

    await this.activitySamples.record({
      sampledAt,
      onlineUsers: this.onlinePresence.countOnlineUsers(),
      openSquads,
    })
  }
}
