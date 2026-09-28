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

/**
 * Loads the environment for a process entry point (server, scripts).
 * Keeps the production contract: invalid variables are reported and the process exits.
 */
export function loadEnv(source: EnvSource = process.env): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    console.error('Invalid environment variables:')
    console.error(z.treeifyError(result.error))
    process.exit(1)
  }

  return result.data
}
