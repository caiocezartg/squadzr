import Fastify, {
  type FastifyInstance,
  type FastifyLoggerOptions,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import websocket from '@fastify/websocket'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod'
import { WS_MAX_PAYLOAD_BYTES } from '@squadzr/schemas/ws'
import type { Env } from '@config/env'
import type { Clock } from '@domain/services/clock.interface'
import type { IGameCatalogSource } from '@domain/services/game-catalog-source.interface'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import { RateLimitedError } from '@application/errors'
import { SystemClock } from '@infrastructure/services/system-clock'
import errorHandlerPlugin from '@infrastructure/plugins/error-handler.plugin'
import edgeGuardPlugin from '@infrastructure/plugins/edge-guard.plugin'
import originGuardPlugin from '@infrastructure/plugins/origin-guard.plugin'
import databasePlugin from '@infrastructure/plugins/database.plugin'
import authPlugin from '@infrastructure/plugins/auth.plugin'
import swaggerPlugin from '@infrastructure/plugins/swagger.plugin'
import wsPlugin from '@infrastructure/websocket/ws.plugin'
import roomCleanupPlugin from '@infrastructure/plugins/room-cleanup.plugin'
import activitySamplerPlugin from '@infrastructure/plugins/activity-sampler.plugin'
import catalogImportExecutorPlugin from '@infrastructure/plugins/catalog-import-executor.plugin'
import type { DiscordInviteRateLimit } from '@interface/routes/discord.routes'
import { registerRoutes } from '@interface/routes'
import { createDiscordInvitePreviews } from '@interface/factories/discord-preview.factory'
import { createRunActivitySampleUseCase } from '@interface/factories/activity-sampler.factory'
import { createRealtime } from '@interface/factories/realtime.factory'
import { createRoomCleanupUseCase } from '@interface/factories/room-cleanup.factory'
import {
  createApiGameCatalogSource,
  createCatalogImportExecutor,
} from '@interface/factories/catalog-import.factory'

declare module 'fastify' {
  interface FastifyInstance {
    /** Injected lifecycle clock: every expiration/limit decision reads it. */
    clock: Clock
    /** The cached source of the Discord server behind a Ready Squad's invite. */
    discordPreviews: DiscordInvitePreviewProvider
  }
}

export interface BuildAppOptions {
  env: Env
  /** Overrides the environment-derived logger (log-capture tests pass their own). */
  logger?: FastifyServerOptions['logger']
  /** Overrides the system clock; tests inject a fixed clock for exact instants. */
  clock?: Clock
  /** Replaces Discord's public invite endpoint; tests inject a stub so none of them reaches the network. */
  discordPreviews?: DiscordInvitePreviewProvider
  /** Replaces the limit on the Discord invite check; tests shrink its window so none of them waits a minute. */
  discordInviteRateLimit?: DiscordInviteRateLimit
  /**
   * Replaces the IGDB source built from the environment; tests inject a fake so none reaches IGDB. Without
   * it and without IGDB credentials the manual Catalog Import is unavailable (503).
   */
  catalogSource?: IGameCatalogSource
}

/**
 * Serializes a request for the request log with the whole query string removed
 * (the path alone is kept), so sensitive parameters can never leak into the log
 * by omission — e.g. the Discord OAuth `code` on the auth callback.
 * Mirrors Fastify's default `req` serializer field for field.
 */
function serializeRequestUrl(req: FastifyRequest): {
  method?: string
  url?: string
  version?: string
  host?: string
  remoteAddress?: string
  remotePort?: number
  [key: string]: unknown
} {
  const params = req.url.indexOf('?')
  // A socket-less request (the in-memory `injectWS` upgrade) has no peer address:
  // `req.ip` throws without a socket, and `req.host` reads `req.ip` under trustProxy.
  const socket = req.socket
  return {
    method: req.method,
    url: params === -1 ? req.url : req.url.slice(0, params),
    version: req.headers['accept-version'] as string | undefined,
    host: socket ? req.host : undefined,
    remoteAddress: socket ? req.ip : undefined,
    remotePort: socket ? socket.remotePort : undefined,
  }
}

/**
 * Fastify merges these over its default serializers (pino-http style). Log-capture
 * test servers reuse them, so their request logs go through the production serializer.
 */
export const requestLogSerializers = { req: serializeRequestUrl }

/** Options of the environment-derived server logger, as consumed by Fastify. */
export function defaultLogger(env: Env): FastifyLoggerOptions {
  return {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    }),
    serializers: requestLogSerializers,
  }
}

/**
 * Composition root: builds a fully wired Fastify instance without listening.
 * Every instance owns its database pool, WebSocket server and timers, and
 * releases all of them on `app.close()`.
 */
export async function buildApp({
  env,
  logger,
  clock,
  discordPreviews,
  discordInviteRateLimit,
  catalogSource,
}: BuildAppOptions): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: env.TRUST_PROXY_HOPS === 0 ? false : env.TRUST_PROXY_HOPS,
    // The router refuses a longer parameter (404) before a route schema sees it, which
    // would hide the schemas' own bounds (a user id is at most 255 characters).
    routerOptions: { maxParamLength: 512 },
    logger: logger ?? defaultLogger(env),
  })

  fastify.decorate('clock', clock ?? new SystemClock())
  fastify.decorate('discordPreviews', discordPreviews ?? createDiscordInvitePreviews(fastify.clock))

  // Route schemas validate and serialize all HTTP input and output: set them before any route.
  fastify.setValidatorCompiler(validatorCompiler)
  fastify.setSerializerCompiler(serializerCompiler)

  await fastify.register(errorHandlerPlugin, { config: env })

  // First of all: a request that did not come through the edge gets nothing, not even a CORS answer.
  await fastify.register(edgeGuardPlugin, { token: env.EDGE_AUTH_TOKEN })

  await fastify.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  })

  // CORS keeps another site from reading an answer, not from sending a cookie-bearing request: the guard
  // refuses every change of state and every WebSocket another site starts.
  await fastify.register(originGuardPlugin, {
    allowedOrigins: [env.CORS_ORIGIN, env.BETTER_AUTH_URL],
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })

  // Opt-in per route (`config.rateLimit`). It runs in `preHandler`, after a route's authentication, so a
  // limited route can key on the signed-in user and an anonymous request never spends anyone's quota.
  // The error handler shapes the 429 like every other error.
  await fastify.register(rateLimit, {
    global: false,
    hook: 'preHandler',
    errorResponseBuilder: () => new RateLimitedError(),
  })

  await fastify.register(websocket, {
    options: {
      maxPayload: WS_MAX_PAYLOAD_BYTES,
    },
  })

  // The API reference maps every route and schema: served while developing, never in production.
  if (env.NODE_ENV !== 'production') await fastify.register(swaggerPlugin)
  await fastify.register(databasePlugin, { connectionString: env.DATABASE_URL })
  await fastify.register(authPlugin, { config: env })
  await fastify.register(wsPlugin, {
    realtime: createRealtime(fastify.db, fastify.clock, fastify.log),
  })
  await fastify.register(roomCleanupPlugin, {
    deleteExpiredRoomsUseCase: createRoomCleanupUseCase(fastify.db, fastify.clock),
  })
  await fastify.register(activitySamplerPlugin, {
    runActivitySampleUseCase: createRunActivitySampleUseCase(
      fastify.db,
      fastify.clock,
      fastify.realtime.manager
    ),
  })
  const manualImportSource = catalogSource ?? createApiGameCatalogSource(env, fastify.clock)
  await fastify.register(catalogImportExecutorPlugin, {
    executor: manualImportSource
      ? createCatalogImportExecutor(fastify.db, fastify.clock, manualImportSource, fastify.log)
      : null,
  })
  await registerRoutes(fastify, { discord: { rateLimit: discordInviteRateLimit } })

  return fastify
}
