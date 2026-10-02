import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { describeContractIssues, type ContractIssue } from '@squadzr/schemas'
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

/** A successful response whose body does not match the contract in @squadzr/schemas. */
export class ApiContractError extends Error {
  public readonly code = 'INVALID_RESPONSE'
  public readonly method: string
  public readonly path: string
  public readonly issues: ContractIssue[]

  constructor(method: string, path: string, issues: ContractIssue[]) {
    super(`Invalid response for ${method} ${path}`)
    this.name = 'ApiContractError'
    this.method = method
    this.path = path
    this.issues = issues
  }
}

const client = axios.create({
  baseURL: env.VITE_API_URL,
  withCredentials: true,
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const body = error.response.data as { message?: string; error?: string }
      throw new ApiClientError(
        body.message ?? error.response.statusText,
        error.response.status,
        body.error
      )
    }
    throw error
  }
)

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

function parseResponse<S extends z.ZodType>(
  schema: S,
  method: Method,
  path: string,
  data: unknown
): z.output<S> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  // The query string and the response body stay out of the diagnostics.
  const [pathname = path] = path.split('?')
  const issues = describeContractIssues(result.error)
  console.error('Invalid API response:', { method, path: pathname, issues })
  throw new ApiContractError(method, pathname, issues)
}

/**
 * With a schema, the response body is parsed before it is returned and a
 * mismatch throws `ApiContractError`. Without one, the body is discarded, so
 * unvalidated data never leaves this module.
 */
async function request<S extends z.ZodType>(
  config: AxiosRequestConfig & { method: Method; url: string },
  schema: S | undefined
): Promise<z.output<S> | void> {
  const { data } = await client.request<unknown>(config)
  if (!schema) return
  return parseResponse(schema, config.method, config.url, data)
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
