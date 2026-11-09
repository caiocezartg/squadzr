import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { IGameCatalogSource } from '@domain/services/game-catalog-source.interface'
import type { ICatalogImportUseCase } from '@application/use-cases/game/catalog-import.use-case'
import { CatalogImportUseCase } from '@application/use-cases/game/catalog-import.use-case'
import { CatalogImportRunRecorder } from '@application/use-cases/game/catalog-import-run-recorder'
import { DrizzleCatalogImportRunRepository } from '@infrastructure/repositories/drizzle-catalog-import-run.repository'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { IgdbGameCatalogSource } from '@infrastructure/igdb/igdb-game-catalog-source'
import { CATALOG_IMPORT_RUN, GAME_CATALOG_IMPORT } from '@config/constants'
import { CURATED_GAMES } from '@interface/catalog/curated-games'
import { GAME_ALIASES } from '@interface/catalog/game-aliases'

/**
 * Composes one Catalog Import: the source is a production seam (IGDB in
 * CCC-90, a fake in tests) and the curated list and safety limits are wired
 * here, the only place concrete repositories are instantiated.
 */
export function createCatalogImportUseCase(
  db: Database,
  clock: Clock,
  source: IGameCatalogSource
): ICatalogImportUseCase {
  return new CatalogImportUseCase(
    source,
    new DrizzleGameRepository(db, clock),
    CURATED_GAMES,
    {
      minimumRetainedFraction: GAME_CATALOG_IMPORT.MINIMUM_RETAINED_FRACTION,
      minimumCandidates: GAME_CATALOG_IMPORT.MINIMUM_CANDIDATES,
    },
    GAME_ALIASES
  )
}

/**
 * Composes the run recorder over the caller's own database connection: the import it records is built
 * by {@link createCatalogImportUseCase}, and every run-row write goes through the same pool as its own
 * statement, outside the import's transaction.
 */
export function createCatalogImportRunRecorder(
  db: Database,
  clock: Clock,
  source: IGameCatalogSource
): CatalogImportRunRecorder {
  return new CatalogImportRunRecorder(
    new DrizzleCatalogImportRunRepository(db),
    new DrizzleGameRepository(db, clock),
    createCatalogImportUseCase(db, clock, source),
    clock,
    {
      heartbeatIntervalMs: CATALOG_IMPORT_RUN.HEARTBEAT_INTERVAL_MS,
      staleHeartbeatMs: CATALOG_IMPORT_RUN.STALE_HEARTBEAT_MS,
      staleRequestedMs: CATALOG_IMPORT_RUN.STALE_REQUESTED_MS,
      errorMessageMaxLength: CATALOG_IMPORT_RUN.ERROR_MESSAGE_MAX_LENGTH,
    }
  )
}

export interface IgdbGameCatalogSourceConfig {
  readonly clientId: string
  readonly clientSecret: string
  readonly popularityThreshold: number
  readonly hypeThreshold: number
}

/**
 * Builds the production Game Catalog Source. The curated ids are injected here,
 * so the IGDB adapter never reaches into the interface layer.
 */
export function createIgdbGameCatalogSource(
  config: IgdbGameCatalogSourceConfig,
  clock: Clock
): IgdbGameCatalogSource {
  return new IgdbGameCatalogSource({
    ...config,
    curatedIgdbIds: CURATED_GAMES.map((game) => game.igdbId),
    clock,
  })
}
