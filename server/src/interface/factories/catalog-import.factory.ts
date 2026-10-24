import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { IGameCatalogSource } from '@domain/services/game-catalog-source.interface'
import type { ICatalogImportUseCase } from '@application/use-cases/game/catalog-import.use-case'
import { CatalogImportUseCase } from '@application/use-cases/game/catalog-import.use-case'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { IgdbGameCatalogSource } from '@infrastructure/igdb/igdb-game-catalog-source'
import { GAME_CATALOG_IMPORT } from '@config/constants'
import { CURATED_GAMES } from '@interface/catalog/curated-games'

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
  return new CatalogImportUseCase(source, new DrizzleGameRepository(db, clock), CURATED_GAMES, {
    minimumRetainedFraction: GAME_CATALOG_IMPORT.MINIMUM_RETAINED_FRACTION,
    minimumCandidates: GAME_CATALOG_IMPORT.MINIMUM_CANDIDATES,
  })
}

export interface IgdbGameCatalogSourceConfig {
  readonly clientId: string
  readonly clientSecret: string
  readonly popularityThreshold: number
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
