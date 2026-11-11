import 'server-only'
import { notFound } from 'next/navigation'
import { canAccessAdminPanel, hasFullAdminAccess, type SessionDto } from '@squadzr/schemas'
import { getRequestSession } from './session'

/**
 * The session of a viewer whose role passes `allowed`, or the app's not-found page for everyone else,
 * so the panel's existence is never revealed. It fails closed. A signed-out visitor, a viewer the rule
 * refuses, a session read that finds nothing and one that throws all end in not-found; there is no path
 * where an unreadable session shows the panel. (The root layout's own session read fails open, which is
 * right for the app and wrong here, so the gate decides from the role alone.) The read is React-cached,
 * so a gate adds no request. The role is checked again by the API on every `/api/admin/*` call.
 */
async function requireSessionWithRole(allowed: (role: string) => boolean): Promise<SessionDto> {
  let session: SessionDto | null
  try {
    session = await getRequestSession()
  } catch {
    return notFound()
  }

  if (!session || !allowed(session.user.role)) return notFound()
  return session
}

/** The gate of the panel itself and of every page a moderator may open: a moderator, an admin or the owner. */
export function requireAdminSession(): Promise<SessionDto> {
  return requireSessionWithRole(canAccessAdminPanel)
}

/** The gate of the admin-only pages (Audit, Catalog Import): an admin or the owner. A moderator gets not-found. */
export function requireFullAdminSession(): Promise<SessionDto> {
  return requireSessionWithRole(hasFullAdminAccess)
}
