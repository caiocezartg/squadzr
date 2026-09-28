import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { createAuth, type Auth, type AuthConfig, type Session } from '@infrastructure/auth'

declare module 'fastify' {
  interface FastifyInstance {
    auth: Auth
  }
  interface FastifyRequest {
    session: Session | null
  }
}

export interface AuthPluginOptions {
  config: AuthConfig
}

async function authPlugin(fastify: FastifyInstance, options: AuthPluginOptions): Promise<void> {
  const auth = createAuth(fastify.db, options.config)

  fastify.decorate('auth', auth)
  fastify.decorateRequest('session', null)

  // Authentication Route Handler using Web API Request/Response
  fastify.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    schema: { hide: true },
    async handler(request: FastifyRequest, reply: FastifyReply) {
      try {
        const url = new URL(request.url, `http://${request.headers.host}`)

        const headers = new Headers()
        Object.entries(request.headers).forEach(([key, value]) => {
          if (value) headers.append(key, Array.isArray(value) ? value.join(', ') : value)
        })

        const req = new Request(url.toString(), {
          method: request.method,
          headers,
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
        })

        const response = await auth.handler(req)

        reply.status(response.status)

        const setCookies: string[] = []
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === 'set-cookie') {
            setCookies.push(value)
          } else {
            reply.header(key, value)
          }
        })
        if (setCookies.length > 0) {
          reply.raw.setHeader('set-cookie', setCookies)
        }

        const body = response.body ? await response.text() : null
        reply.send(body)
      } catch (error) {
        fastify.log.error(error, 'Authentication Error')
        reply.status(500).send({
          error: 'Internal authentication error',
          code: 'AUTH_FAILURE',
        })
      }
    },
  })

  // Session hook for API and WebSocket routes
  const sessionRoutes = ['/api/', '/ws']
  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    if (!sessionRoutes.some((prefix) => request.url.startsWith(prefix))) return
    if (request.url.startsWith('/api/auth')) return

    const session = await auth.api.getSession({
      headers: request.headers as Record<string, string>,
    })
    request.session = session
  })
}

export default fp(authPlugin, {
  name: 'auth',
  fastify: '5.x',
  dependencies: ['database'],
})
