import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.url(),
  CORS_ORIGIN: z.url({ error: 'CORS_ORIGIN must be a valid URL' }).default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),

  // Discord OAuth
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_CLIENT_SECRET: z.string().min(1, 'DISCORD_CLIENT_SECRET is required'),
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
