import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  adminGameDetailResponseSchema,
  adminGameIdParamSchema,
  adminGamesQuerySchema,
  adminGamesResponseSchema,
  adminGamesSummarySchema,
  errorResponseSchema as errorResponse,
} from '@squadzr/schemas'
import { requireFullAdmin } from '@interface/hooks/admin.hook'
import { createAdminCatalogGamesController } from '@interface/factories/admin-catalog-games.factory'

export async function adminCatalogGamesRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const gamesController = createAdminCatalogGamesController(fastify.db, fastify.clock)

  app.get('/api/admin/catalog/games', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'List the catalog Games',
      description:
        'Returns every Game of the catalog, listed or not, 20 per page, each with its usage: the Open Squads now and the Squads that became Ready for it, all time. `q` matches the name or an alias, ignoring case, accents and punctuation. `status` is `all` (default), `listed`, `delisted` or `featured` (a Listed Game with a featured rank). `sort` is `popularity` (default, highest first), `name`, `newest` (by creation), `openSquads` or `completedSquads` (most used first); every order ends on the Game id. A page past the end gives no items and the real total. Requires the admin or owner role (a moderator is refused).',
      security: [{ session: [] }],
      querystring: adminGamesQuerySchema,
      response: {
        200: adminGamesResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: gamesController.list.bind(gamesController),
  })

  app.get('/api/admin/catalog/games/summary', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'Summarize the catalog Games',
      description:
        'Returns how many Games are listed, delisted and featured (a Listed Game with a featured rank), and the Games that entered (created) and left (delisted) the catalog during the last succeeded Catalog Import Run, each with the real total and at most five names. `lastImport` is null before any run succeeded. Requires the admin or owner role (a moderator is refused).',
      security: [{ session: [] }],
      response: {
        200: adminGamesSummarySchema,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: gamesController.summary.bind(gamesController),
  })

  app.get('/api/admin/catalog/games/:id', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'Get a catalog Game',
      description:
        'Returns one Game of the catalog, listed or not, with every field, its usage and its newest Open Squads (at most 20; `game.usage.openSquads` is the real count). An unknown Game answers 404 `GAME_NOT_FOUND`. Requires the admin or owner role (a moderator is refused).',
      security: [{ session: [] }],
      params: adminGameIdParamSchema,
      response: {
        200: adminGameDetailResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
      },
    },
    handler: gamesController.get.bind(gamesController),
  })
}
