import 'server-only'
import { headers } from 'next/headers'
import { cache } from 'react'
import { sessionResponseSchema, type SessionDto } from '@squadzr/schemas'
import { ApiClientError, ApiContractError } from '@/lib/api-contract'
import { serverApi } from './api'

// `disableRefresh` leaves the renewal to the browser. Only the response to the browser's own call
// carries the renewed cookie, so a server read must not consume it.
const GET_SESSION_PATH = '/api/auth/get-session?disableRefresh=true'
// Each try waits this long, so a slow Fastify cannot hold up every page.
const SESSION_TIMEOUT_MS = 2_000
// The first try and one retry.
const SESSION_TRIES = 2

/**
 * Reads the session of the viewer who sent `cookie`. A `null` body and a 401 both mean signed out;
 * a body that breaks the contract throws. A network error, a timeout or a 5xx is retried once. When
 * the retry fails too, the error is logged once and the page renders signed out, so the browser's
 * check corrects it.
 */
export async function loadSession(cookie: string | null): Promise<SessionDto | null> {
  let lastFailure: unknown

  for (let attempt = 1; attempt <= SESSION_TRIES; attempt += 1) {
    try {
      return await readSession(cookie)
    } catch (error) {
      if (!isRetryable(error)) throw error
      lastFailure = error
    }
  }

  console.error(
    'Session read failed; the page renders signed out until the browser checks it:',
    lastFailure
  )
  return null
}

/**
 * One try at the session, bounded by the timeout. A 401 is signed out; anything else is either an
 * answer or an error for the caller to retry or rethrow.
 */
async function readSession(cookie: string | null): Promise<SessionDto | null> {
  try {
    return await serverApi.get(
      GET_SESSION_PATH,
      sessionResponseSchema,
      { credentials: 'viewer', caching: 'uncached', cookie },
      { timeoutMs: SESSION_TIMEOUT_MS }
    )
  } catch (error) {
    if (isUnauthorized(error)) return null
    throw error
  }
}

/** The session of the current request. React's cache makes every server component share one read. */
export const getRequestSession = cache(async () => loadSession((await headers()).get('cookie')))

/**
 * A try is retried when Fastify gives no answer (a network error or a timeout) or answers with a
 * 5xx, whatever the body. An answer below 500 is not retried: a refused request or a body that
 * breaks its contract would fail the same way again.
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof ApiClientError || error instanceof ApiContractError) {
    return error.status >= 500
  }
  return true
}

function isUnauthorized(error: unknown): boolean {
  return (
    (error instanceof ApiClientError || error instanceof ApiContractError) && error.status === 401
  )
}
