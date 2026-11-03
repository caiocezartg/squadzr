import type { FastifyInstance, FastifyServerOptions } from 'fastify'
import { inject } from 'vitest'
import { buildApp } from '@/app'
import type { Clock } from '@domain/services/clock.interface'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import type { DiscordInviteRateLimit } from '@interface/routes/discord.routes'
import { parseEnv, type Env } from '@config/env'
import { createIsolatedDatabase } from './postgres'

/**
 * Discord's answer for every invite unless a test says otherwise: tests never reach the network. Every
 * invite exists, so the suites that create Squads are not stopped by the create-time check.
 */
export const KNOWN_INVITES: DiscordInvitePreviewProvider = {
  fetch: () =>
    Promise.resolve({
      kind: 'found',
      preview: {
        name: 'Squadzr Test Server',
        iconUrl: null,
        backdropUrl: null,
        memberCount: 42,
        onlineCount: 7,
        expiresAt: null,
      },
    }),
}

/** Better Auth secret of every test server; session cookies in tests are signed with it. */
export const TEST_AUTH_SECRET = 'integration-test-secret-with-32-plus-chars'

export interface TestServer {
  app: FastifyInstance
  databaseUrl: string
  /** Closes Fastify (WebSockets, timers, pool) and drops the test's database. */
  close: () => Promise<void>
}

export interface BuildTestServerOptions {
  /** Injects a deterministic clock; defaults to the production system clock. */
  clock?: Clock
  /** Replaces Discord's invite endpoint, which no test reaches. Defaults to a server that knows every invite. */
  discordPreviews?: DiscordInvitePreviewProvider
  /** Replaces the limit on the Discord invite check, so a test can shrink its window. */
  discordInviteRateLimit?: DiscordInviteRateLimit
  /**
   * Replaces the production logger for tests that read request logs. Omitted, the
   * server logs through `defaultLogger(env)`, which stays quiet at the test level.
   */
  logger?: FastifyServerOptions['logger']
}

export function createTestEnv(overrides: Partial<Env> & Pick<Env, 'DATABASE_URL'>): Env {
  return parseEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'fatal',
    BETTER_AUTH_SECRET: TEST_AUTH_SECRET,
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
export async function buildTestServer(
  overrides: Partial<Env> = {},
  options: BuildTestServerOptions = {}
): Promise<TestServer> {
  const database = await createIsolatedDatabase(inject('postgres'))
  const env = createTestEnv({ ...overrides, DATABASE_URL: database.url })

  let app: FastifyInstance | undefined
  try {
    app = await buildApp({
      env,
      logger: options.logger,
      clock: options.clock,
      discordPreviews: options.discordPreviews ?? KNOWN_INVITES,
      discordInviteRateLimit: options.discordInviteRateLimit,
    })
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
