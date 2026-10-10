import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import fastifySwagger from '@fastify/swagger'
import ScalarApiReference from '@scalar/fastify-api-reference'
import { jsonSchemaTransform } from 'fastify-type-provider-zod'

async function swaggerPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Squadzr API',
        description:
          'API for connecting gamers to form complete teams (premades) for multiplayer games.',
        version: '0.1.0',
      },
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Games', description: 'Game catalog endpoints' },
        { name: 'Rooms', description: 'Room management endpoints' },
        { name: 'Users', description: 'User endpoints' },
      ],
      components: {
        securitySchemes: {
          session: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
            description: 'Session cookie from Discord OAuth login',
          },
        },
      },
    },
    transform: jsonSchemaTransform,
  })

  await fastify.register(ScalarApiReference, {
    routePrefix: '/docs',
    configuration: {
      theme: 'default',
    },
  })
}

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '5.x',
})
