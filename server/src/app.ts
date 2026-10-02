import Fastify, {
  type FastifyInstance,
  type FastifyLoggerOptions,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import websocket from '@fastify/websocket'
import type { Env } from '@config/env'
import errorHandlerPlugin from '@infrastructure/plugins/error-handler.plugin'
import databasePlugin from '@infrastructure/plugins/database.plugin'
import authPlugin from '@infrastructure/plugins/auth.plugin'
import swaggerPlugin from '@infrastructure/plugins/swagger.plugin'
import wsPlugin from '@infrastructure/websocket/ws.plugin'
import roomCleanupPlugin from '@infrastructure/plugins/room-cleanup.plugin'
import { registerRoutes } from '@interface/routes'

export interface BuildAppOptions {
  env: Env
  /** Overrides the environment-derived logger (tests pass `false`). */
  logger?: FastifyServerOptions['logger']
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
  return {
    method: req.method,
    url: params === -1 ? req.url : req.url.slice(0, params),
    version: req.headers['accept-version'] as string | undefined,
    host: req.host,
    remoteAddress: req.ip,
    remotePort: req.socket ? req.socket.remotePort : undefined,
  }
}

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
    // Fastify merges these over its default serializers (pino-http style).
    serializers: { req: serializeRequestUrl },
  }
}

/**
 * Composition root: builds a fully wired Fastify instance without listening.
 * Every instance owns its database pool, WebSocket server and timers, and
 * releases all of them on `app.close()`.
 */
export async function buildApp({ env, logger }: BuildAppOptions): Promise<FastifyInstance> {
  const fastify = Fastify({
    trustProxy: true,
    logger: logger ?? defaultLogger(env),
  })

  await fastify.register(errorHandlerPlugin)

  await fastify.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  })

  await fastify.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  })

  await fastify.register(websocket, {
    options: {
      maxPayload: 1048576,
    },
  })

  await fastify.register(swaggerPlugin)
  await fastify.register(databasePlugin, { connectionString: env.DATABASE_URL })
  await fastify.register(authPlugin, { config: env })
  await fastify.register(wsPlugin)
  await fastify.register(roomCleanupPlugin)
  await registerRoutes(fastify)

  return fastify
}
