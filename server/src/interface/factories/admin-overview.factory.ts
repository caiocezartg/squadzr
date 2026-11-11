import { ADMIN } from '@config/constants'
import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { OnlinePresence } from '@domain/services/online-presence.interface'
import { DrizzleActivitySampleRepository } from '@infrastructure/repositories/drizzle-activity-sample.repository'
import { DrizzleAdminStatsRepository } from '@infrastructure/repositories/drizzle-admin-stats.repository'
import { DrizzleCatalogImportRunRepository } from '@infrastructure/repositories/drizzle-catalog-import-run.repository'
import { DrizzleAuditEntryRepository } from '@infrastructure/repositories/drizzle-audit-entry.repository'
import { GetAdminActivityUseCase } from '@application/use-cases/admin/get-admin-activity.use-case'
import { GetAdminOverviewUseCase } from '@application/use-cases/admin/get-admin-overview.use-case'
import { AdminOverviewController } from '@interface/controllers/admin-overview.controller'

export function createAdminOverviewController(
  db: Database,
  clock: Clock,
  onlinePresence: OnlinePresence
): AdminOverviewController {
  const statsRepository = new DrizzleAdminStatsRepository(db)
  const getAdminActivityUseCase = new GetAdminActivityUseCase(
    statsRepository,
    clock,
    ADMIN.TIME_ZONE,
    new DrizzleActivitySampleRepository(db)
  )

  return new AdminOverviewController({
    getAdminActivityUseCase,
    getAdminOverviewUseCase: new GetAdminOverviewUseCase(
      statsRepository,
      new DrizzleAuditEntryRepository(db),
      new DrizzleCatalogImportRunRepository(db),
      getAdminActivityUseCase,
      onlinePresence,
      clock
    ),
  })
}
