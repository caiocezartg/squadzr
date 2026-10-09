import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { HealthController, type HealthResponse } from '@interface/controllers/health.controller'

// Typed against the controller's HealthResponse, so the wire schema cannot drift from the payload.
const healthResponse: z.ZodType<HealthResponse> = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
})

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const controller = new HealthController()

  app.get('/health', {
    schema: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the current health status of the server.',
      response: {
        200: healthResponse,
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
        200: healthResponse,
        503: healthResponse,
      },
    },
    handler: controller.readiness.bind(controller),
  })
}
