import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { errorResponseSchema } from '@squadzr/schemas'
import { env } from '@/env'
import { ApiClientError, parseApiResponse } from './api-contract'

export { ApiClientError, ApiContractError } from './api-contract'

const client = axios.create({
  baseURL: env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response) {
      const { status, config, data } = error.response
      const body = parseApiResponse(
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
  return parseApiResponse(schema, { method: config.method, path: config.url, status }, data)
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
