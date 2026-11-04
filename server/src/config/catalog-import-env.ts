import { z } from 'zod'

/**
 * Fallback popularity threshold, calibrated against the live IGDB catalog in
 * CCC-90: 50 returned 1,673 filtered candidates on 2026-10-23, and 1,675 with
 * the curated games that miss the filter (Minecraft's IGDB type is "port" and
 * EA Sports FC 26 sits below the threshold).
 */
export const DEFAULT_IGDB_POPULARITY_THRESHOLD = 50

/**
 * Fallback hype threshold for games released in the last 180 days, calibrated
 * against the live IGDB catalog in #101 on 2026-11-04. It is the largest N that
 * still admits Call of Duty: Modern Warfare 4 (`hypes` 61), released on
 * 2026-10-23 with 26 ratings. N = 50 adds 10 games the window would otherwise
 * miss and leaves 1,686 filtered candidates, against 1,673 on 2026-10-23, before
 * the curated games. For the same window N = 10 adds 60 games, N = 25 adds 26
 * and N = 100 adds 2 and misses Modern Warfare 4.
 */
export const DEFAULT_IGDB_HYPE_THRESHOLD = 50

function optionalThresholdSchema(defaultValue: number) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().min(0).default(defaultValue)
  )
}

const optionalOverride = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.stringbool().default(false)
)

/**
 * The whole environment of the Catalog Import. It deliberately shares nothing
 * with the API's schema: the hosted job gets the database URL and the Twitch
 * app credentials, and none of the auth or Discord variables.
 */
const catalogImportEnvSchema = z.object({
  DATABASE_URL: z.url(),
  IGDB_CLIENT_ID: z.string().min(1, 'IGDB_CLIENT_ID is required'),
  IGDB_CLIENT_SECRET: z.string().min(1, 'IGDB_CLIENT_SECRET is required'),
  IGDB_POPULARITY_THRESHOLD: optionalThresholdSchema(DEFAULT_IGDB_POPULARITY_THRESHOLD),
  /**
   * 0 means no hype floor among the games that have `hypes`: a release without
   * `hypes` fails `hypes >= 0` in IGDB and enters only through the rating count.
   */
  IGDB_HYPE_THRESHOLD: optionalThresholdSchema(DEFAULT_IGDB_HYPE_THRESHOLD),
  CATALOG_IMPORT_OVERRIDE_FRACTION_CHECK: optionalOverride,
})

export type CatalogImportEnv = z.infer<typeof catalogImportEnvSchema>

type EnvSource = Record<string, string | undefined>

/**
 * Parses and validates an environment source without touching the process.
 * Throws when the source is invalid, so tests can build isolated configurations.
 */
export function parseCatalogImportEnv(source: EnvSource): CatalogImportEnv {
  const result = catalogImportEnvSchema.safeParse(source)

  if (!result.success) {
    throw new Error(
      `Invalid catalog import environment variables: ${JSON.stringify(z.treeifyError(result.error))}`
    )
  }

  return result.data
}

/**
 * Loads the Catalog Import environment from the process. Never reads a `.env`
 * file: local Bun commands pass one explicitly and hosted jobs inject variables.
 */
export function loadCatalogImportEnv(source: EnvSource = process.env): CatalogImportEnv {
  const result = catalogImportEnvSchema.safeParse(source)

  if (!result.success) {
    console.error('Invalid catalog import environment variables:')
    console.error(z.treeifyError(result.error))
    process.exit(1)
  }

  return result.data
}
