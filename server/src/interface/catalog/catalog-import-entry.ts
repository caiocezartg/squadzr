import type { Clock } from '@domain/services/clock.interface'
import type { IGameCatalogSource } from '@domain/services/game-catalog-source.interface'
import type { CatalogImportSummary } from '@application/use-cases/game/catalog-import.use-case'
import { createDatabase } from '@infrastructure/database/drizzle'
import { SystemClock } from '@infrastructure/services/system-clock'
import { createCatalogImportUseCase } from '@interface/factories/catalog-import.factory'

/** Structured sink of one run; tests inject a fake to read the summary. */
export interface CatalogImportLogger {
  info(summary: CatalogImportSummary): void
  error(error: unknown): void
}

export interface CatalogImportEntryOptions {
  readonly databaseUrl: string
  readonly source: IGameCatalogSource
  readonly overrideFractionCheck?: boolean
  readonly clock?: Clock
  readonly logger?: CatalogImportLogger
}

const consoleLogger: CatalogImportLogger = {
  info: (summary) => console.log(JSON.stringify(summary)),
  error: (error) => console.error('Catalog Import failed:', error),
}

/**
 * Process entry of the Catalog Import (CCC-89, scheduled in CCC-91): opens its
 * own pool, runs one import, logs one structured summary and always closes the
 * pool. Returns the process exit code; a caller assigns it to `process.exitCode`
 * so a failed run stops the schedule without hiding the error.
 */
export async function runCatalogImport(options: CatalogImportEntryOptions): Promise<number> {
  const logger = options.logger ?? consoleLogger
  const { db, close } = createDatabase(options.databaseUrl)
  let exitCode: number

  try {
    const useCase = createCatalogImportUseCase(
      db,
      options.clock ?? new SystemClock(),
      options.source
    )
    const summary = await useCase.execute({
      overrideFractionCheck: options.overrideFractionCheck ?? false,
    })
    logger.info(summary)
    exitCode = 0
  } catch (error) {
    logger.error(error)
    exitCode = 1
  }

  try {
    await close()
  } catch (error) {
    logger.error(error)
    exitCode = 1
  }

  return exitCode
}
