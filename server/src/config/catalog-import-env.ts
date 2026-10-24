import { z } from 'zod'

/**
 * Fallback popularity threshold, calibrated against the live IGDB catalog in
 * CCC-90: 50 returned 1,673 filtered candidates on 2026-10-23, and 1,675 with
 * the curated games that miss the filter (Minecraft's IGDB type is "port" and
 * EA Sports FC 26 sits below the threshold).
 */
export const DEFAULT_IGDB_POPULARITY_THRESHOLD = 50

const optionalThreshold = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.coerce.number().int().min(0).default(DEFAULT_IGDB_POPULARITY_THRESHOLD)
)

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
  IGDB_POPULARITY_THRESHOLD: optionalThreshold,
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
