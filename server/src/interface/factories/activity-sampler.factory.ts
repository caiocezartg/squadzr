import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import { DrizzleActivitySampleRepository } from '@infrastructure/repositories/drizzle-activity-sample.repository'
import { DrizzleAdminStatsRepository } from '@infrastructure/repositories/drizzle-admin-stats.repository'
import {
  RunActivitySampleUseCase,
  type IRunActivitySampleUseCase,
} from '@application/use-cases/admin/run-activity-sample.use-case'

export function createRunActivitySampleUseCase(
  db: Database,
  clock: Clock,
  onlinePresence: OnlinePresence
): IRunActivitySampleUseCase {
  return new RunActivitySampleUseCase(
    onlinePresence,
    new DrizzleAdminStatsRepository(db),
    new DrizzleActivitySampleRepository(db),
    clock
  )
}
