import type { Database } from '@infrastructure/database/drizzle'
import { DrizzleCatalogImportRunRepository } from '@infrastructure/repositories/drizzle-catalog-import-run.repository'
import { ListCatalogImportRunsUseCase } from '@application/use-cases/admin/list-catalog-import-runs.use-case'
import { AdminCatalogController } from '@interface/controllers/admin-catalog.controller'

export function createAdminCatalogController(db: Database): AdminCatalogController {
  return new AdminCatalogController({
    listCatalogImportRunsUseCase: new ListCatalogImportRunsUseCase(
      new DrizzleCatalogImportRunRepository(db)
    ),
  })
}
