import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  catalogImportRunsResponseSchema,
  errorResponseSchema as errorResponse,
  pageQuerySchema,
  requestCatalogImportRunResponseSchema,
} from '@squadzr/schemas'
import { requireFullAdmin } from '@interface/hooks/admin.hook'
import { createAdminCatalogController } from '@interface/factories/admin-catalog.factory'

export async function adminCatalogRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const catalogController = createAdminCatalogController(
    fastify.db,
    fastify.clock,
    fastify.catalogImportExecutor
  )

  app.get('/api/admin/catalog-import/runs', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'List Catalog Import Runs',
      description:
        'Returns the recorded Catalog Import Runs newest first, 20 per page. A page past the end gives no items and the real total. A run is `scheduled` (the daily cron) or `manual`; its status is `requested`, `running`, `succeeded`, `safety_stop`, `failed` or `interrupted`; only a succeeded run carries a summary of counts. Besides the page it carries `manualRun` (`available`, or `available: false` with the `availableAt` instant a manual run may be requested again) and `activeRun`, the run holding the slot (`requested` or `running`) whatever the page, or null. Requires the admin or owner role (a moderator is refused).',
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
  app.post('/api/admin/catalog-import/runs', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'Request a manual Catalog Import',
      description:
        'Queues a manual Catalog Import Run for the signed-in admin and writes a `catalog_import_requested` Audit Entry with it; an executor inside the API runs it, so the answer is 202 with the run (`requested`) and the panel follows it with the history. The route takes no body and no option: the import always keeps its safety checks. 503 `CATALOG_IMPORT_UNAVAILABLE` when the API has no IGDB credentials; 422 `CATALOG_IMPORT_MANUAL_LIMIT` when a manual run was requested in the last 24 hours, whatever became of it (scheduled runs never count); 422 `CATALOG_IMPORT_RUNNING` when another run is requested or running. Requires the admin or owner role (a moderator is refused).',
      security: [{ session: [] }],
      response: {
        202: requestCatalogImportRunResponseSchema,
        401: errorResponse,
        403: errorResponse,
        422: errorResponse,
        503: errorResponse,
      },
    },
    handler: catalogController.requestRun.bind(catalogController),
  })
}
