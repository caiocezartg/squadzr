import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { DrizzleAdminGameRepository } from '@infrastructure/repositories/drizzle-admin-game.repository'
import { DrizzleAdminSquadRepository } from '@infrastructure/repositories/drizzle-admin-squad.repository'
import { DrizzleCatalogImportRunRepository } from '@infrastructure/repositories/drizzle-catalog-import-run.repository'
import { GetAdminGameUseCase } from '@application/use-cases/admin/get-admin-game.use-case'
import { GetAdminGamesSummaryUseCase } from '@application/use-cases/admin/get-admin-games-summary.use-case'
import { ListAdminGamesUseCase } from '@application/use-cases/admin/list-admin-games.use-case'
import { AdminCatalogGamesController } from '@interface/controllers/admin-catalog-games.controller'

export function createAdminCatalogGamesController(
  db: Database,
  clock: Clock
): AdminCatalogGamesController {
  const adminGameRepository = new DrizzleAdminGameRepository(db, clock)

  return new AdminCatalogGamesController({
    listAdminGamesUseCase: new ListAdminGamesUseCase(adminGameRepository),
    getAdminGameUseCase: new GetAdminGameUseCase(
      adminGameRepository,
      new DrizzleAdminSquadRepository(db, clock)
    ),
    getAdminGamesSummaryUseCase: new GetAdminGamesSummaryUseCase(
      adminGameRepository,
      new DrizzleCatalogImportRunRepository(db)
    ),
  })
}
