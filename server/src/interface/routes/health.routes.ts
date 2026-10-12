import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { healthResponseSchema } from '@squadzr/schemas'
import { createHealthController } from '@interface/factories/health.factory'

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const controller = createHealthController(fastify.db)

  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the current health status of the server.',
      response: {
        200: healthResponseSchema,
      },
    },
    handler: controller.check.bind(controller),
  })

  app.get('/health/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness check',
      description: 'Checks if the server and database are ready to accept requests.',
      response: {
        200: healthResponseSchema,
        503: healthResponseSchema,
      },
    },
    handler: controller.readiness.bind(controller),
  })
}
