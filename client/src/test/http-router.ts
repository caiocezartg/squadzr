/**
 * Deterministic HTTP for client tests.
 *
 * `src/lib/api.ts` sends every request through the global `fetch`. `installHttpFetch()` replaces it
 * with an in-memory route table, so every request is answered from the table instead of the network.
 * Responses carry JSON bodies, as the real transport does, and a status of 400 or more is an error
 * response that the API layer parses against its contract.
 */

import { vi } from 'vitest'

export interface MockHttpRequest {
  method: string
  path: string
  query: URLSearchParams
  params: Record<string, string>
  body: unknown
  /** The caller's cancellation signal, as `fetch` would receive it. */
  signal?: AbortSignal
}

export interface MockHttpResponse {
  status?: number
  body?: unknown
}

export type MockHttpHandler = (
  request: MockHttpRequest
) => MockHttpResponse | Promise<MockHttpResponse>

interface RegisteredRoute {
  method: string
  segments: string[]
  handler: MockHttpHandler
}

const routes: RegisteredRoute[] = []
let requestLog: MockHttpRequest[] = []

export function httpOk(body: unknown): MockHttpResponse {
  return { status: 200, body }
}

export function httpCreated(body: unknown): MockHttpResponse {
  return { status: 201, body }
}

export function httpError(status: number, body: unknown): MockHttpResponse {
  return { status, body }
}

/** Registers a route handler. Later registrations win over earlier ones. */
export function onHttp(method: string, pattern: string, handler: MockHttpHandler): void {
  routes.push({ method: method.toUpperCase(), segments: splitPattern(pattern), handler })
}

export function resetHttpRoutes(): void {
  routes.length = 0
  requestLog = []
}

/** Every request the app made since the last reset, in order. */
export function getHttpLog(): readonly MockHttpRequest[] {
  return requestLog
}

export function countHttpCalls(method: string, pattern: string): number {
  const segments = splitPattern(pattern)
  return requestLog.filter(
    (request) =>
      request.method === method.toUpperCase() && matches(request.path.split('/').slice(1), segments)
  ).length
}

/** Installs the route table as the global `fetch`. */
export function installHttpFetch(): void {
  vi.stubGlobal('fetch', httpFetch)
}

function splitPattern(pattern: string): string[] {
  return pattern.split('/').slice(1)
}

function matches(pathSegments: string[], patternSegments: string[]): boolean {
  if (pathSegments.length !== patternSegments.length) return false
  return patternSegments.every(
    (segment, i) => segment.startsWith(':') || segment === pathSegments[i]
  )
}

function extractParams(pathSegments: string[], patternSegments: string[]): Record<string, string> {
  const params: Record<string, string> = {}
  patternSegments.forEach((segment, i) => {
    if (!segment.startsWith(':')) return
    params[segment.slice(1)] = pathSegments[i] ?? ''
  })
  return params
}

const httpFetch = async (input: string | URL, init: RequestInit = {}): Promise<Response> => {
  const request = buildRequest(input, init)
  requestLog.push(request)

  const match = findRoute(request)
  if (!match) {
    return jsonResponse(500, {
      message: `No HTTP mock registered for ${request.method} ${request.path} (use onHttp in the test).`,
      error: 'TEST_HTTP_ADAPTER_MISSING_ROUTE',
    })
  }

  const { route, params } = match
  const result = await untilAborted(route.handler({ ...request, params }), request.signal)
  const status = result.status ?? 200

  // A successful response always has a body; an error keeps exactly the body the test gave it.
  return jsonResponse(status, status >= 400 ? result.body : (result.body ?? {}))
}

/**
 * Rejects like `fetch` when the caller's signal aborts, even while a test
 * handler still holds the response. Without a signal the handler's result is
 * returned untouched.
 */
async function untilAborted<T>(
  result: T | Promise<T>,
  signal: AbortSignal | undefined
): Promise<T> {
  const settled = Promise.resolve(result)
  if (!signal) return settled
  if (signal.aborted) throw abortError()

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    settled.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      }
    )
  })
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError')
}

function findRoute(
  request: MockHttpRequest
): { route: RegisteredRoute; params: Record<string, string> } | null {
  const pathSegments = request.path.split('/').slice(1)
  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i]
    if (!route) continue
    if (route.method !== request.method) continue
    if (!matches(pathSegments, route.segments)) continue
    return { route, params: extractParams(pathSegments, route.segments) }
  }
  return null
}

function buildRequest(input: string | URL, init: RequestInit): MockHttpRequest {
  const url = new URL(String(input), 'http://localhost:3000')
  const method = (init.method ?? 'GET').toUpperCase()
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    params: {},
    body: parseBody(init.body, method),
    signal: init.signal ?? undefined,
  }
}

function parseBody(data: unknown, method: string): unknown {
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return undefined
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data) as unknown
  } catch {
    return data
  }
}

/** A JSON response, or one without a body when the handler gave none. */
function jsonResponse(status: number, body: unknown): Response {
  const hasNoBody = status === 204 || status === 205 || status === 304
  return new Response(hasNoBody || body === undefined ? null : JSON.stringify(body), {
    status,
    statusText: statusTextFor(status),
    headers: { 'Content-Type': 'application/json' },
  })
}

function statusTextFor(status: number): string {
  if (status === 400) return 'Bad Request'
  if (status === 401) return 'Unauthorized'
  if (status === 404) return 'Not Found'
  if (status === 409) return 'Conflict'
  if (status === 500) return 'Internal Server Error'
  return 'Response'
}
