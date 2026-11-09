import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  catalogImportRunsResponseSchema,
  errorResponseSchema as errorResponse,
  pageQuerySchema,
} from '@squadzr/schemas'
import { requireFullAdmin } from '@interface/hooks/admin.hook'
import { createAdminCatalogController } from '@interface/factories/admin-catalog.factory'

export async function adminCatalogRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const catalogController = createAdminCatalogController(fastify.db)

  app.get('/api/admin/catalog-import/runs', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'List Catalog Import Runs',
      description:
        'Returns the recorded Catalog Import Runs newest first, 20 per page. A page past the end gives no items and the real total. A run is `scheduled` (the daily cron) or `manual`; its status is `requested`, `running`, `succeeded`, `safety_stop`, `failed` or `interrupted`; only a succeeded run carries a summary of counts. Requires the admin or owner role (a moderator is refused).',
      security: [{ session: [] }],
      querystring: pageQuerySchema,
      response: {
        200: catalogImportRunsResponseSchema,
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: catalogController.listRuns.bind(catalogController),
  })
}
