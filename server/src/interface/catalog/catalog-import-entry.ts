import type { Clock } from '@domain/services/clock.interface'
import type { IGameCatalogSource } from '@domain/services/game-catalog-source.interface'
import type { CatalogImportSummary } from '@application/use-cases/game/catalog-import.use-case'
import { createDatabase } from '@infrastructure/database/drizzle'
import { SystemClock } from '@infrastructure/services/system-clock'
import { createCatalogImportRunRecorder } from '@interface/factories/catalog-import.factory'

/** Structured sink of one run; tests inject a fake to read the summary. */
export interface CatalogImportLogger {
  info(summary: CatalogImportSummary): void
  /** The slot was taken by another run: nothing ran and nothing was recorded. */
  skipped(): void
  error(error: unknown): void
  /** A heartbeat could not be written; the run goes on and staleness handles a dead one. */
  heartbeatFailed(error: unknown): void
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
  skipped: () => console.log('Catalog Import skipped: another run is requested or running'),
  error: (error) => console.error('Catalog Import failed:', error),
  heartbeatFailed: (error) => console.warn('Catalog Import heartbeat could not be written:', error),
}

/**
 * Process entry of the Catalog Import (CCC-89, scheduled in CCC-91): opens its
 * own pool, claims the run slot as a `scheduled` Catalog Import Run, runs one
 * import, logs one structured summary and always closes the pool. Returns the
 * process exit code: 0 on a success and when another run holds the slot (it logs
 * and records nothing), 1 on a safety stop or a failure. A caller assigns it to
 * `process.exitCode` so a failed run stops the schedule without hiding the error.
 */
export async function runCatalogImport(options: CatalogImportEntryOptions): Promise<number> {
  const logger = options.logger ?? consoleLogger
  const { db, close } = createDatabase(options.databaseUrl)
  let exitCode: number

  try {
    const recorder = createCatalogImportRunRecorder(
      db,
      options.clock ?? new SystemClock(),
      options.source,
      (error) => logger.heartbeatFailed(error)
    )
    const result = await recorder.run({
      trigger: 'scheduled',
      requestedBy: null,
      overrideFractionCheck: options.overrideFractionCheck ?? false,
    })

    if (result.kind === 'busy') {
      logger.skipped()
      exitCode = 0
    } else if (result.kind === 'succeeded') {
      logger.info(result.summary)
      exitCode = 0
    } else {
      logger.error(result.error)
      exitCode = 1
    }
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
