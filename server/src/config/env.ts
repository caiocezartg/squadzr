import { z } from 'zod'
import {
  igdbClientIdSchema,
  igdbClientSecretSchema,
  igdbHypeThresholdSchema,
  igdbPopularityThresholdSchema,
} from './catalog-import-env'

// An unset variable and an empty one both mean "not configured".
function optionalIgdbCredential<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional())
}

// A bare parent domain such as `squadzr.app`: DNS labels, at least two, ending in a
// letter-only TLD.
const parentDomainSchema = z
  .string()
  .regex(
    /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i,
    'BETTER_AUTH_COOKIE_DOMAIN must be a parent domain such as squadzr.app'
  )

// A whole number from a string variable, `fallback` when it is unset. `min` is 0 unless a limit cannot be off.
function wholeNumber(name: string, fallback: number, min = 0) {
  return z
    .string()
    .regex(/^\d+$/, `${name} must be a whole number`)
    .default(String(fallback))
    .transform(Number)
    .pipe(z.number().min(min, `${name} must be at least ${min}`).max(Number.MAX_SAFE_INTEGER))
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url({ error: 'CORS_ORIGIN must be a valid URL' }).default('http://localhost:5173'),
  // Proxies in front of the API whose x-forwarded-for entries are believed: one edge proxy by default. Only
  // the entries those hops appended are trusted, so a client cannot pick its own address. 0 trusts none.
  TRUST_PROXY_HOPS: z
    .string()
    .regex(/^\d+$/, 'TRUST_PROXY_HOPS must be a whole number of proxies')
    .default('1')
    .transform(Number),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  // The origin lock. Set: a request without this value in the `x-squadzr-edge-auth` header, which the
  // Cloudflare edge writes on everything it forwards, is refused with 403 (the health checks aside). Unset
  // or empty: no lock. Visible ASCII only, so the HTTP layer can carry it unchanged.
  EDGE_AUTH_TOKEN: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z
      .string()
      .regex(/^[!-~]+$/, 'EDGE_AUTH_TOKEN must be visible ASCII without spaces')
      .min(32, 'EDGE_AUTH_TOKEN must be at least 32 characters')
      .optional()
  ),

  // Abuse limits, per client address (`request.ip`, which behind the origin lock is the visitor's). Every
  // route allows `RATE_LIMIT_MAX` requests per `RATE_LIMIT_WINDOW_MS` (IPv6 addresses count by /64), the
  // health checks aside. A WebSocket upgrade is limited harder, and a client address may hold only so many
  // sockets at once. 0 turns a limit off.
  RATE_LIMIT_MAX: wholeNumber('RATE_LIMIT_MAX', 300),
  RATE_LIMIT_WINDOW_MS: wholeNumber('RATE_LIMIT_WINDOW_MS', 60_000, 1),
  WS_UPGRADES_PER_MINUTE: wholeNumber('WS_UPGRADES_PER_MINUTE', 20),
  WS_MAX_CONNECTIONS_PER_IP: wholeNumber('WS_MAX_CONNECTIONS_PER_IP', 10),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  // Shares the session cookie with every subdomain of this parent domain. Unset: host-only cookies.
  BETTER_AUTH_COOKIE_DOMAIN: parentDomainSchema.optional(),

  // Discord OAuth
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'DISCORD_CLIENT_SECRET is required'),

  // IGDB, for the manual Catalog Import run from the admin panel. Optional: without the credentials the
  // API boots and answers 503 `CATALOG_IMPORT_UNAVAILABLE`, while the cron keeps its own environment.
  // Same rules as the cron's (`catalog-import-env.ts`), same thresholds.
  IGDB_CLIENT_ID: optionalIgdbCredential(igdbClientIdSchema),
  IGDB_CLIENT_SECRET: optionalIgdbCredential(igdbClientSecretSchema),
  IGDB_POPULARITY_THRESHOLD: igdbPopularityThresholdSchema,
  IGDB_HYPE_THRESHOLD: igdbHypeThresholdSchema,
})

export type Env = z.infer<typeof envSchema>

/** The database connection alone, for scripts that never read auth or Discord settings. */
const databaseEnvSchema = envSchema.pick({ DATABASE_URL: true })

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>

type EnvSource = Record<string, string | undefined>

/**
 * Parses and validates an environment source without touching the process.
 * Throws when the source is invalid, so tests can build isolated configurations.
 */
export function parseEnv(source: EnvSource): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    throw new Error(
      `Invalid environment variables: ${JSON.stringify(z.treeifyError(result.error))}`
    )
  }

  return result.data
}

/** Validates a source against a schema, exiting the process when a variable is invalid. */
function parseOrExit<T extends z.ZodType>(schema: T, source: EnvSource): z.output<T> {
  const result = schema.safeParse(source)

  if (!result.success) {
    console.error('Invalid environment variables:')
    console.error(z.treeifyError(result.error))
    process.exit(1)
  }

  return result.data
}

/**
 * Loads the environment for a process entry point (server, scripts).
 * Keeps the production contract: invalid variables are reported and the process exits.
 */
export function loadEnv(source: EnvSource = process.env): Env {
  return parseOrExit(envSchema, source)
}

/**
 * Loads only the database connection, so a script runs with `DATABASE_URL` alone.
 * Same contract as `loadEnv`: invalid variables are reported and the process exits.
 */
export function loadDatabaseEnv(source: EnvSource = process.env): DatabaseEnv {
  return parseOrExit(databaseEnvSchema, source)
}
