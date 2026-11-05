import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  auditEntriesResponseSchema,
  errorResponseSchema as errorResponse,
  pageQuerySchema,
} from '@squadzr/schemas'
import { createAdminAuditController } from '@interface/factories/admin.factory'

export async function adminAuditRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const auditController = createAdminAuditController(fastify.db)

  app.get('/api/admin/audit', {
    schema: {
      tags: ['Admin'],
      summary: 'List audit entries',
      description:
        'Returns the Audit Entries newest first, 20 per page. A page past the end gives no items and the real total. Requires the admin role.',
      security: [{ session: [] }],
      querystring: pageQuerySchema,
      response: {
        200: auditEntriesResponseSchema,
        401: errorResponse,
        403: errorResponse,
      },
    },
    handler: auditController.list.bind(auditController),
  })
}
