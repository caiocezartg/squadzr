import type { FastifyInstance } from 'fastify'
import { requireAdmin } from '@interface/hooks/admin.hook'
import { adminAuditRoutes } from './admin-audit.routes'
import { adminUsersRoutes } from './admin-users.routes'

/**
 * Every `/api/admin/*` route. The guard is a hook of this plugin's scope, so a route added to it is
 * protected without repeating the check: signed out is 401 `UNAUTHORIZED`, a user is 403
 * `ADMIN_REQUIRED`. It runs in `preValidation`, after the session read and before the route's schema is
 * checked, so a signed-out or non-admin request with bad input still gets 401 or 403, never a 400.
 * The panel's features register their routes here.
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preValidation', requireAdmin)

  await fastify.register(adminAuditRoutes)
  await fastify.register(adminUsersRoutes)
}
