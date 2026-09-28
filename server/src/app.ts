import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
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

function defaultLogger(env: Env): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    ...(env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    }),
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
