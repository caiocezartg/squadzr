import type { FastifyInstance } from 'fastify'
import { requirePanelAccess } from '@interface/hooks/admin.hook'
import { adminAuditRoutes } from './admin-audit.routes'
import { adminCatalogRoutes } from './admin-catalog.routes'
import { adminOverviewRoutes } from './admin-overview.routes'
import { adminUsersRoutes } from './admin-users.routes'
import { adminSquadsRoutes } from './admin-squads.routes'

/**
 * Every `/api/admin/*` route. The guard is a hook of this plugin's scope, so a route added to it is
 * protected without repeating the check: signed out is 401 `UNAUTHORIZED`, a user is 403
 * `ADMIN_REQUIRED`, and a moderator, an admin or the owner gets in. A route only admins and the owner
 * may call adds `requireFullAdmin` as its own `preValidation`. The scope guard runs in `preValidation`, after the session read and before the route's schema is
 * checked, so a signed-out or non-admin request with bad input still gets 401 or 403, never a 400.
 * The panel's features register their routes here.
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preValidation', requirePanelAccess)

  await fastify.register(adminAuditRoutes)
  await fastify.register(adminUsersRoutes)
  await fastify.register(adminOverviewRoutes)
  await fastify.register(adminSquadsRoutes)
  await fastify.register(adminCatalogRoutes)
}
