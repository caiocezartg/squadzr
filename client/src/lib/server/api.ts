import 'server-only'
import type { z } from 'zod'
import { errorResponseSchema } from '@squadzr/schemas'
import { API_INTERNAL_URL } from '@/env.server'
import { ApiClientError, parseApiResponse } from '@/lib/api-contract'

/** How long a public response stays in Next's data cache before a request refreshes it. */
const REVALIDATE_SECONDS = 5 * 60

/**
 * Who the call speaks for and how its response may be cached. The two are chosen separately, but
 * only an anonymous response is shared between visitors, so only it may be revalidated: a viewer's
 * response is that viewer's data and is always read fresh.
 */
export type RequestPolicy =
  | { readonly credentials: 'anonymous'; readonly caching: 'revalidated' | 'uncached' }
  | { readonly credentials: 'viewer'; readonly caching: 'uncached'; readonly cookie: string | null }

type ServerFetchInit = RequestInit & { next?: { revalidate: number } }

/** The fetch options a policy stands for. The cookie goes out only with a viewer call. */
function requestInit(policy: RequestPolicy): ServerFetchInit {
  const headers = new Headers({ accept: 'application/json' })
  if (policy.credentials === 'viewer' && policy.cookie) headers.set('cookie', policy.cookie)

  if (policy.credentials === 'anonymous' && policy.caching === 'revalidated') {
    return { headers, next: { revalidate: REVALIDATE_SECONDS } }
  }
  return { headers, cache: 'no-store' }
}

/**
 * Reads one Fastify route. The body is parsed with the caller's schema, and an error body with the
 * shared error contract, so a response that breaks either throws `ApiContractError`.
 */
async function get<S extends z.ZodType>(
  path: string,
  schema: S,
  policy: RequestPolicy
): Promise<z.output<S>> {
  const response = await fetch(
    `${API_INTERNAL_URL.replace(/\/+$/, '')}${path}`,
    requestInit(policy)
  )
  const context = { method: 'GET', path, status: response.status }
  // A body that is not JSON cannot match a contract, so it reaches the parser as undefined.
  const body: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    const error = parseApiResponse(errorResponseSchema, context, body)
    throw new ApiClientError(error.message, response.status, error.error)
  }
  return parseApiResponse(schema, context, body)
}

/** Every call the Next server makes to Fastify goes through here. */
export const serverApi = { get }
