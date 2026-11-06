import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import {
  auditEntriesResponseSchema,
  errorResponseSchema as errorResponse,
  pageQuerySchema,
} from '@squadzr/schemas'
import { requireFullAdmin } from '@interface/hooks/admin.hook'
import { createAdminAuditController } from '@interface/factories/admin.factory'

export async function adminAuditRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const auditController = createAdminAuditController(fastify.db)

  app.get('/api/admin/audit', {
    preValidation: requireFullAdmin,
    schema: {
      tags: ['Admin'],
      summary: 'List audit entries',
      description:
        'Returns the Audit Entries newest first, 20 per page. A page past the end gives no items and the real total. Requires the admin or owner role (a moderator is refused).',
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
