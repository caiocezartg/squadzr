import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { describeContractIssues, errorResponseSchema, type ContractIssue } from '@squadzr/schemas'
import { env } from '@/env'

export class ApiClientError extends Error {
  public readonly status: number
  public readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

/** A response, successful or not, whose body does not match its contract in @squadzr/schemas. */
export class ApiContractError extends Error {
  public readonly code = 'INVALID_RESPONSE'
  public readonly method: string
  public readonly path: string
  public readonly status: number
  public readonly issues: ContractIssue[]

  constructor(method: string, path: string, status: number, issues: ContractIssue[]) {
    super(`Invalid response for ${method} ${path}`)
    this.name = 'ApiContractError'
    this.method = method
    this.path = path
    this.status = status
    this.issues = issues
  }
}

const client = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
})

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface ResponseContext {
  method: string
  path: string
  status: number
}

function parseResponse<S extends z.ZodType>(
  schema: S,
  { method, path, status }: ResponseContext,
  data: unknown
): z.output<S> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  // The query string and the response body stay out of the diagnostics.
  const [pathname = path] = path.split('?')
  const issues = describeContractIssues(result.error)
  console.error('Invalid API response:', { method, path: pathname, status, issues })
  throw new ApiContractError(method, pathname, status, issues)
}

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const { status, config, data } = error.response
      const body = parseResponse(
        errorResponseSchema,
        { method: (config.method ?? 'get').toUpperCase(), path: config.url ?? '', status },
        data
      )
      throw new ApiClientError(body.message, status, body.error)
    }
    throw error
  }
)

/**
 * With a schema, the response body is parsed before it is returned and a
 * mismatch throws `ApiContractError`. Without one, the body is discarded, so
 * unvalidated data never leaves this module.
 */
async function request<S extends z.ZodType>(
  config: AxiosRequestConfig & { method: Method; url: string },
  schema: S | undefined
): Promise<z.output<S> | void> {
  const { data, status } = await client.request<unknown>(config)
  if (!schema) return
  return parseResponse(schema, { method: config.method, path: config.url, status }, data)
}

function get<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>> {
  return request({ method: 'GET', url: path }, schema) as Promise<z.output<S>>
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
