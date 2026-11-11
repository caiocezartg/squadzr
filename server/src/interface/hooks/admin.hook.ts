import { canAccessAdminPanel, hasFullAdminAccess } from '@squadzr/schemas'
import { AdminRequiredError } from '@application/errors'
import { requireAuth } from './auth.hook'

type GuardedRequest = Parameters<typeof requireAuth>[0]

/**
 * The guard of every `/api/admin/*` route: a moderator, an admin or the owner. No session is the auth
 * guard's 401; a session whose role does not open the panel is 403 `ADMIN_REQUIRED`. The role comes from
 * this request's session read, which Better Auth takes from the database with no cookie cache, so a
 * demotion applies on the next request.
 */
export async function requirePanelAccess(request: GuardedRequest): Promise<void> {
  await requireAuth(request)
  if (!canAccessAdminPanel(request.session?.user.role)) {
    throw new AdminRequiredError()
  }
}

/**
 * The per-route guard of the admin-or-owner routes (Audit, role changes, Catalog Import): an admin
 * or the owner, so a moderator who got past the scope's guard is 403 `ADMIN_REQUIRED` here. Declare it
 * as the route's `preValidation`; it runs after the scope's guard and before the route's schema.
 */
export async function requireFullAdmin(request: GuardedRequest): Promise<void> {
  await requireAuth(request)
  if (!hasFullAdminAccess(request.session?.user.role)) {
    throw new AdminRequiredError()
  }
}
