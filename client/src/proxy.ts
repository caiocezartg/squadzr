import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasSessionCookie } from '@/lib/server/session-cookie'

/**
 * Turns a visitor away from My Squads before the app layout renders. The layout waits for the Squad
 * Board's read so the sidebar's count is in the HTML, and a redirect thrown by the page would wait
 * behind that read. The check reads the `Cookie` header and never calls the API; the page keeps the
 * same check for a request that does not pass through here.
 */
export function proxy(request: NextRequest) {
  if (hasSessionCookie(request.headers.get('cookie'))) return NextResponse.next()

  return NextResponse.redirect(new URL('/', request.url))
}

export const config = {
  matcher: '/squads/my',
}
