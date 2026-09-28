import type { FastifyInstance } from 'fastify'
import { inject } from 'vitest'
import { buildApp } from '@/app'
import { parseEnv, type Env } from '@config/env'
import { createIsolatedDatabase } from './postgres'

export interface TestServer {
  app: FastifyInstance
  databaseUrl: string
  /** Closes Fastify (WebSockets, timers, pool) and drops the test's database. */
  close: () => Promise<void>
}

export function createTestEnv(overrides: Partial<Env> & Pick<Env, 'DATABASE_URL'>): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    BETTER_AUTH_SECRET: 'integration-test-secret-with-32-plus-chars',
    BETTER_AUTH_URL: 'http://localhost:3000',
    CORS_ORIGIN: 'http://localhost:5173',
    DISCORD_CLIENT_ID: 'integration-test-client-id',
    DISCORD_CLIENT_SECRET: 'integration-test-client-secret',
    ...Object.fromEntries(Object.entries(overrides).map(([key, value]) => [key, String(value)])),
  })
}

/**
 * Builds a ready, non-listening server backed by its own freshly migrated
 * PostgreSQL database. Several instances can coexist in the same process.
 */
export async function buildTestServer(overrides: Partial<Env> = {}): Promise<TestServer> {
  const database = await createIsolatedDatabase(inject('postgres'))
  const env = createTestEnv({ ...overrides, DATABASE_URL: database.url })

  let app: FastifyInstance | undefined
  try {
    app = await buildApp({ env, logger: false })
    await app.ready()
  } catch (error) {
    await app?.close()
    await database.drop()
    throw error
  }

  const ready = app
  return {
    app: ready,
    databaseUrl: database.url,
    close: async () => {
      await ready.close()
      await database.drop()
    },
  }
}
