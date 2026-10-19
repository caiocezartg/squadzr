import type { z } from 'zod'
import { describeContractIssues, type ContractIssue } from '@squadzr/schemas'

/** An HTTP error response the server answered with its error contract. */
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

export interface ResponseContext {
  method: string
  path: string
  status: number
}

/**
 * Parses a response body against its contract. A mismatch logs its diagnostics and throws
 * `ApiContractError`, so unvalidated data never leaves the API layer.
 */
export function parseApiResponse<S extends z.ZodType>(
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
