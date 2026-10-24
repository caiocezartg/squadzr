import { loadCatalogImportEnv } from '@config/catalog-import-env'
import { runCatalogImport } from '@interface/catalog/catalog-import-entry'
import { createIgdbGameCatalogSource } from '@interface/factories/catalog-import.factory'
import { SystemClock } from '@infrastructure/services/system-clock'

/**
 * `db:import-games`: one local Catalog Import against the database URL and the
 * Twitch credentials of the repository root `.env`, which the Bun command
 * loads. The process itself never reads a file, so the hosted job runs this
 * script with `--no-env-file` and injected variables.
 */
async function main(): Promise<void> {
  const env = loadCatalogImportEnv()
  const source = createIgdbGameCatalogSource(
    {
      clientId: env.IGDB_CLIENT_ID,
      clientSecret: env.IGDB_CLIENT_SECRET,
      popularityThreshold: env.IGDB_POPULARITY_THRESHOLD,
    },
    new SystemClock()
  )

  process.exitCode = await runCatalogImport({
    databaseUrl: env.DATABASE_URL,
    source,
    overrideFractionCheck: env.CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK,
  })
}

main().catch((error) => {
  console.error('Catalog Import failed:', error)
  process.exitCode = 1
})
