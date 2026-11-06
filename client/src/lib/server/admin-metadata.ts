import 'server-only'
import type { Metadata } from 'next'
import { canAccessAdminPanel, hasFullAdminAccess } from '@squadzr/schemas'
import { getRequestSession } from './session'

// The title of the app's not-found page (app/not-found.tsx), spelled out because a layout's title
// stops the root template from reaching the pages below it. Next adds its own `noindex` to a 404.
const NOT_FOUND_METADATA: Metadata = { title: { absolute: 'Page not found · Squadzr' } }

/** Who the page is for: everyone the panel admits, or only admins and the owner. */
export type AdminAccess = 'panel' | 'full'

/**
 * The metadata of an admin page, behind the same rule as the admin gate: only a viewer the page admits
 * (`access`, the whole panel by default) gets the panel's title (`title`, or the layout's default
 * without one) and its `noindex`. Anyone else, and a session read that fails, gets the not-found page's
 * own head, so a 404 under `/admin` reads like any other and the head does not reveal the panel. The
 * session read is React-cached, so this adds no request.
 */
export async function adminMetadata(
  admin: Metadata,
  access: AdminAccess = 'panel'
): Promise<Metadata> {
  try {
    const session = await getRequestSession()
    const allowed = access === 'full' ? hasFullAdminAccess : canAccessAdminPanel
    return allowed(session?.user.role) ? admin : NOT_FOUND_METADATA
  } catch {
    return NOT_FOUND_METADATA
  }
}
