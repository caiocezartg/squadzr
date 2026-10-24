import { loadCatalogImportEnv } from '@config/catalog-import-env'
import { runCatalogImport } from '@interface/catalog/catalog-import-entry'
import { createIgdbGameCatalogSource } from '@interface/factories/catalog-import.factory'
import { SystemClock } from '@infrastructure/services/system-clock'

/**
 * `db:import-games`: one local Catalog Import against the database URL of the
 * environment. Bun loads the `.env` files (root for the database, server-local
 * for the Twitch credentials); the process itself never reads a file, so the
 * hosted job only needs injected variables.
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

  const exitCode = await runCatalogImport({
    databaseUrl: env.DATABASE_URL,
    source,
    overrideFractionCheck: env.CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK,
  })

  if (source.dropped > 0) {
    console.warn(JSON.stringify({ event: 'igdb_candidates_dropped', dropped: source.dropped }))
  }

  process.exitCode = exitCode
}

main().catch((error) => {
  console.error('Catalog Import failed:', error)
  process.exitCode = 1
})
