import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  activityQuerySchema,
  activityResponseSchema,
  errorResponseSchema as errorResponse,
  overviewQuerySchema,
  overviewResponseSchema,
} from '@squadzr/schemas'
import { createAdminOverviewController } from '@interface/factories/admin-overview.factory'

export async function adminOverviewRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const overviewController = createAdminOverviewController(
    fastify.db,
    fastify.clock,
    fastify.realtime.manager
  )

  app.get('/api/admin/overview', {
    schema: {
      tags: ['Admin'],
      summary: 'Get the admin overview',
      description:
        'Returns the live numbers (online users, total users, Open Squads, completed Squads), the completed Squads and sign-ups of the last 7, 30 or 90 days (default 30) beside the previous period of the same length, and the latest 5 audit entries. Days are calendar days in America/Sao_Paulo. `recentAudit` is null for a moderator, who may not read the audit. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      querystring: overviewQuerySchema,
      response: {
        200: overviewResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: overviewController.overview.bind(overviewController),
  })

  app.get('/api/admin/activity', {
    schema: {
      tags: ['Admin'],
      summary: 'Get the Activity chart series',
      description:
        'Returns one row per day of the last 7, 30 or 90 days (default 30), oldest first, as `{ date, current, previous }`: `previous` is the day one period earlier. `completed` counts Squad Records by Ready instant and `signups` counts users by creation. Days are calendar days in America/Sao_Paulo. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      querystring: activityQuerySchema,
      response: {
        200: activityResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: overviewController.activity.bind(overviewController),
  })
}
