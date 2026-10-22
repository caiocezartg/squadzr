import 'server-only'

// Better Auth names its session cookie this way, and adds `__Secure-` when it sets the cookie over
// HTTPS (production). The server's auth config does not change either name.
const SESSION_COOKIE_NAME = 'better-auth.session_token'
const SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set([
  SESSION_COOKIE_NAME,
  `__Secure-${SESSION_COOKIE_NAME}`,
])

/**
 * Whether the request carries a session cookie. It reads the `Cookie` header and never calls the
 * API, so it says nothing about the session being valid: an expired or forged cookie counts. Use it
 * to turn away a viewer who has no session at all without waiting on a read.
 */
export function hasSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false

  return cookieHeader.split(';').some((pair) => {
    const separator = pair.indexOf('=')
    if (separator === -1) return false

    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    return value !== '' && SESSION_COOKIE_NAMES.has(name)
  })
}
