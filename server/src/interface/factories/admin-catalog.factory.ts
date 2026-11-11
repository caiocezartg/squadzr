import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import { DrizzleCatalogImportRunRepository } from '@infrastructure/repositories/drizzle-catalog-import-run.repository'
import { ListCatalogImportRunsUseCase } from '@application/use-cases/admin/list-catalog-import-runs.use-case'
import { RequestCatalogImportRunUseCase } from '@application/use-cases/admin/request-catalog-import-run.use-case'
import { AdminCatalogController } from '@interface/controllers/admin-catalog.controller'

export interface AdminCatalogExecutor {
  /** True when the API can run an import (it has IGDB credentials). */
  readonly enabled: boolean
  wake(): void
}

export function createAdminCatalogController(
  db: Database,
  clock: Clock,
  executor: AdminCatalogExecutor
): AdminCatalogController {
  const runRepository = new DrizzleCatalogImportRunRepository(db)

  return new AdminCatalogController({
    listCatalogImportRunsUseCase: new ListCatalogImportRunsUseCase(runRepository, clock),
    requestCatalogImportRunUseCase: new RequestCatalogImportRunUseCase(
      runRepository,
      clock,
      executor.enabled
    ),
    wakeExecutor: () => executor.wake(),
  })
}
