import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '@interface/hooks/admin.hook'
import { adminAuditRoutes } from './admin-audit.routes'

/**
 * Every `/api/admin/*` route. The guard is a hook of this plugin's scope, so a route added to it is
 * protected without repeating the check: signed out is 401 `UNAUTHORIZED`, a user is 403
 * `ADMIN_REQUIRED`. The panel's features register their routes here.
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', requireAdmin)

  await fastify.register(adminAuditRoutes)
}
