/**
 * Deterministic HTTP adapter for client tests.
 *
 * `src/lib/api.ts` builds its axios instance from `axios.create`, which
 * snapshots the global defaults at module load. `installHttpAdapter()` swaps
 * the global default adapter BEFORE any component imports `@/lib/api`, so
 * every request is answered from an in-memory route table instead of the
 * network. Responses are returned as JSON strings exactly like the real
 * transport, and errors are surfaced as `AxiosError` instances carrying a
 * response so the existing `ApiClientError` interceptor behaves unchanged.
 */

import axios, { AxiosError, AxiosHeaders } from 'axios'
import type {
  AxiosAdapter,
  AxiosResponse,
  InternalAxiosRequestConfig,
  RawAxiosRequestHeaders,
} from 'axios'

export interface MockHttpRequest {
  method: string
  path: string
  query: URLSearchParams
  params: Record<string, string>
  body: unknown
}

export interface MockHttpResponse {
  status?: number
  body?: unknown
}

export type MockHttpHandler = (request: MockHttpRequest) => MockHttpResponse

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

/** Installs the mock adapter as axios' global default. */
export function installHttpAdapter(): void {
  axios.defaults.adapter = httpAdapter
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

const httpAdapter: AxiosAdapter = async (config) => {
  const request = buildRequest(config)
  requestLog.push(request)

  const match = findRoute(request)
  if (!match) {
    throw responseError(config, 500, {
      message: `No HTTP mock registered for ${request.method} ${request.path} (use onHttp in the test).`,
      error: 'TEST_HTTP_ADAPTER_MISSING_ROUTE',
    })
  }

  const { route, params } = match
  const result = route.handler({ ...request, params })
  const status = result.status ?? 200

  if (status >= 400) {
    throw responseError(config, status, result.body)
  }

  return {
    data: JSON.stringify(result.body ?? {}),
    status,
    statusText: statusTextFor(status),
    headers: new AxiosHeaders(),
    config,
  }
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

function buildRequest(config: InternalAxiosRequestConfig): MockHttpRequest {
  const url = new URL(config.url ?? '/', config.baseURL ?? 'http://localhost:3000')
  const method = (config.method ?? 'get').toUpperCase()
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    params: {},
    body: parseBody(config.data, method),
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

function responseError(
  config: InternalAxiosRequestConfig,
  status: number,
  body: unknown
): AxiosError {
  const response: AxiosResponse = {
    data: body,
    status,
    statusText: statusTextFor(status),
    headers: new AxiosHeaders() as unknown as RawAxiosRequestHeaders,
    config,
  }
  return new AxiosError(statusTextFor(status), String(status), config, {}, response)
}

function statusTextFor(status: number): string {
  if (status === 400) return 'Bad Request'
  if (status === 401) return 'Unauthorized'
  if (status === 404) return 'Not Found'
  if (status === 409) return 'Conflict'
  if (status === 500) return 'Internal Server Error'
  return 'Response'
}
