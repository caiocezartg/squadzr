import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  adminSquadDetailResponseSchema,
  adminSquadIdParamSchema,
  adminSquadsQuerySchema,
  adminSquadsResponseSchema,
  closeSquadInputSchema,
  errorResponseSchema as errorResponse,
} from '@squadzr/schemas'
import { createAdminSquadsController } from '@interface/factories/admin.factory'

export async function adminSquadsRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const squadsController = createAdminSquadsController(
    fastify.db,
    fastify.broadcaster,
    fastify.clock
  )

  app.get('/api/admin/squads', {
    schema: {
      tags: ['Admin'],
      summary: 'List Open Squads',
      description:
        'Returns the Open Squads (the validity rule of the Squad Limits) newest first, 20 per page. `q` matches the Squad name, its code or the host name, ignoring case; `gameId` keeps one Game. A page past the end gives no items and the real total. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      querystring: adminSquadsQuerySchema,
      response: {
        200: adminSquadsResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: squadsController.list.bind(squadsController),
  })

  app.get('/api/admin/squads/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Get an Open Squad',
      description:
        'Returns one Open Squad with its game, platform, language, code, creation, last activity, roster (host marked, join times) and the full Discord invite. A Squad that is unknown, Ready or expired answers 404. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      params: adminSquadIdParamSchema,
      response: {
        200: adminSquadDetailResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
      },
    },
    handler: squadsController.get.bind(squadsController),
  })

  app.post('/api/admin/squads/:id/close', {
    schema: {
      tags: ['Admin'],
      summary: 'Close an Open Squad',
      description:
        'Admin Closure: deletes the Open Squad, tells every member (host included) with the reason and writes a `squad_closed` Audit Entry, in one transaction. The lobby and the Squad Board hear about it live. An unknown or already deleted Squad answers 404 `ROOM_NOT_FOUND`; a Ready or expired one 422 `ROOM_NOT_OPEN`. Requires the moderator, admin or owner role.',
      security: [{ session: [] }],
      params: adminSquadIdParamSchema,
      body: closeSquadInputSchema,
      response: {
        204: z.null().describe('The Squad is closed.'),
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        422: errorResponse,
      },
    },
    handler: squadsController.close.bind(squadsController),
  })
}
