import type { z } from 'zod'
import { errorResponseSchema } from '@squadzr/schemas'
import { env } from '@/env'
import { ApiClientError, parseApiResponse } from './api-contract'

export { ApiClientError, ApiContractError } from './api-contract'

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestConfig {
  readonly method: Method
  readonly url: string
  readonly data?: unknown
  /** Lets the caller abandon the request, as a search that a newer term superseded. */
  readonly signal?: AbortSignal
}

/** The API base URL and a path, joined by a single slash. */
function absoluteUrl(path: string): string {
  return `${env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/** The body as the server sent it: the parsed JSON, or the raw text when it is not JSON. */
async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/**
 * Sends a request with the session cookie. A non-2xx response throws `ApiClientError` with the
 * server's error code. With a schema, the response body is parsed before it is returned and a
 * mismatch throws `ApiContractError`. Without one, the body is discarded, so unvalidated data never
 * leaves this module.
 */
async function request<S extends z.ZodType>(
  { method, url, data, signal }: RequestConfig,
  schema: S | undefined
): Promise<z.output<S> | void> {
  const hasBody = data !== undefined
  const response = await fetch(absoluteUrl(url), {
    method,
    credentials: 'include',
    signal,
    headers: hasBody
      ? { Accept: 'application/json', 'Content-Type': 'application/json' }
      : { Accept: 'application/json' },
    body: hasBody ? JSON.stringify(data) : undefined,
  })
  const body = await readBody(response)
  const context = { method, path: url, status: response.status }

  if (!response.ok) {
    const error = parseApiResponse(errorResponseSchema, context, body)
    throw new ApiClientError(error.message, response.status, error.error)
  }
  if (!schema) return
  return parseApiResponse(schema, context, body)
}

function get<S extends z.ZodType>(
  path: string,
  schema: S,
  signal?: AbortSignal
): Promise<z.output<S>> {
  return request({ method: 'GET', url: path, signal }, schema) as Promise<z.output<S>>
}

function send(method: Exclude<Method, 'GET' | 'DELETE'>) {
  function call(path: string, body?: unknown): Promise<void>
  function call<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<z.output<S>>
  function call<S extends z.ZodType>(
    path: string,
    body?: unknown,
    schema?: S
  ): Promise<z.output<S> | void> {
    return request({ method, url: path, data: body }, schema)
  }
  return call
}

function remove(path: string): Promise<void>
function remove<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>>
function remove<S extends z.ZodType>(path: string, schema?: S): Promise<z.output<S> | void> {
  return request({ method: 'DELETE', url: path }, schema)
}

export const api = {
  get,
  post: send('POST'),
  put: send('PUT'),
  patch: send('PATCH'),
  delete: remove,
}
