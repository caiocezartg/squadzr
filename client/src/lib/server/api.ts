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
  | {
      readonly credentials: 'viewer'
      readonly caching: 'uncached'
      readonly cookie: string | null
      /** The viewer's `x-forwarded-for`, so Fastify rate-limits the viewer and not the Next server. */
      readonly forwardedFor?: string | null
    }

type ServerFetchInit = RequestInit & { next?: { revalidate: number } }

/** Per-call options. `timeoutMs` rejects the call when Fastify has not finished answering in time. */
export interface GetOptions {
  readonly timeoutMs?: number
}

/** The fetch options a policy stands for. The cookie and the client IP go out only with a viewer call. */
function requestInit(policy: RequestPolicy, { timeoutMs }: GetOptions): ServerFetchInit {
  const headers = new Headers({ accept: 'application/json' })
  if (policy.credentials === 'viewer') {
    if (policy.cookie) headers.set('cookie', policy.cookie)
    if (policy.forwardedFor) headers.set('x-forwarded-for', policy.forwardedFor)
  }
  // The signal runs until the body is read too, so a stalled body rejects like a dropped connection.
  const signal = timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs)

  if (policy.credentials === 'anonymous' && policy.caching === 'revalidated') {
    return { headers, signal, next: { revalidate: REVALIDATE_SECONDS } }
  }
  return { headers, signal, cache: 'no-store' }
}

/**
 * The body parsed as JSON, or `undefined` when it is not JSON or cannot be read, so the parser
 * rejects it as a broken contract. On a call with a timeout, a read that fails midway, such as a
 * timed-out or dropped body, throws raw: it is a failed call for the caller to retry, like a
 * dropped connection.
 */
async function readJson(response: Response, bounded: boolean): Promise<unknown> {
  try {
    return JSON.parse(await response.text()) as unknown
  } catch (error) {
    if (bounded && !(error instanceof SyntaxError)) throw error
    return undefined
  }
}

/**
 * Reads one Fastify route. The body is parsed with the caller's schema, and an error body with the
 * shared error contract, so a response that breaks either throws `ApiContractError`.
 */
async function get<S extends z.ZodType>(
  path: string,
  schema: S,
  policy: RequestPolicy,
  options: GetOptions = {}
): Promise<z.output<S>> {
  const response = await fetch(
    `${API_INTERNAL_URL.replace(/\/+$/, '')}${path}`,
    requestInit(policy, options)
  )
  const context = { method: 'GET', path, status: response.status }
  // A body that is not JSON cannot match a contract, so it reaches the parser as undefined.
  const body = await readJson(response, options.timeoutMs !== undefined)

  if (!response.ok) {
    const error = parseApiResponse(errorResponseSchema, context, body)
    throw new ApiClientError(error.message, response.status, error.error)
  }
  return parseApiResponse(schema, context, body)
}

/** Every call the Next server makes to Fastify goes through here. */
export const serverApi = { get }
