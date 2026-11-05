import 'server-only'
import { notFound } from 'next/navigation'
import type { SessionDto } from '@squadzr/schemas'
import { getRequestSession } from './session'

/**
 * The gate of every admin page: the session of an admin, or the app's not-found page for everyone
 * else, so the panel's existence is never revealed. It fails closed. A signed-out visitor, a user, a
 * session read that finds nothing and one that throws all end in not-found; there is no path where an
 * unreadable session shows the panel. (The root layout's own session read fails open, which is right for
 * the app and wrong here, so the gate decides from the role alone.) The read is React-cached, so the
 * gate adds no request. The role is checked again by the API on every `/api/admin/*` call.
 */
export async function requireAdminSession(): Promise<SessionDto> {
  let session: SessionDto | null
  try {
    session = await getRequestSession()
  } catch {
    return notFound()
  }

  if (session?.user.role !== 'admin') return notFound()
  return session
}
