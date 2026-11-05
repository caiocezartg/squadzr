import { AdminRequiredError } from '@application/errors'
import { requireAuth } from './auth.hook'

/**
 * The guard of every `/api/admin/*` route. No session is the auth guard's 401; a session whose role is
 * not `admin` is 403 `ADMIN_REQUIRED`. The role comes from this request's session read, which Better
 * Auth takes from the database with no cookie cache, so a demotion applies on the next request.
 */
export async function requireAdmin(request: Parameters<typeof requireAuth>[0]): Promise<void> {
  await requireAuth(request)
  if (request.session?.user.role !== 'admin') {
    throw new AdminRequiredError()
  }
}
