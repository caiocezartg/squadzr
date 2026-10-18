import 'server-only'
import { headers } from 'next/headers'
import { cache } from 'react'
import { sessionResponseSchema, type SessionDto } from '@squadzr/schemas'
import { ApiClientError, ApiContractError } from '@/lib/api-contract'
import { serverApi } from './api'

// `disableRefresh` leaves the renewal to the browser. Only the response to the browser's own call
// carries the renewed cookie, so a server read must not consume it.
const GET_SESSION_PATH = '/api/auth/get-session?disableRefresh=true'

/**
 * Reads the session of the viewer who sent `cookie`. A `null` body and a 401 both mean signed out;
 * a body that breaks the contract throws.
 */
export async function loadSession(cookie: string | null): Promise<SessionDto | null> {
  try {
    return await serverApi.get(GET_SESSION_PATH, sessionResponseSchema, {
      credentials: 'viewer',
      caching: 'uncached',
      cookie,
    })
  } catch (error) {
    if (isUnauthorized(error)) return null
    throw error
  }
}

/** The session of the current request. React's cache makes every server component share one read. */
export const getRequestSession = cache(async () => loadSession((await headers()).get('cookie')))

function isUnauthorized(error: unknown): boolean {
  return (
    (error instanceof ApiClientError || error instanceof ApiContractError) && error.status === 401
  )
}
