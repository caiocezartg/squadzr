import type { FastifyInstance, FastifyError, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import { ResponseSerializationError } from 'fastify-type-provider-zod'
import { ZodError } from 'zod'
import { describeContractIssues } from '@squadzr/schemas'
import { AppError } from '@application/errors'

interface ErrorResponse {
  error: string
  message: string
  details?: unknown
}

interface ParsedError {
  statusCode: number
  response: ErrorResponse
}

function parseError(error: FastifyError | Error): ParsedError {
  if (error instanceof ZodError) {
    return {
      statusCode: 400,
      response: {
        error: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    }
  }

  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      response: {
        error: error.code,
        message: error.message,
      },
    }
  }

  if ('validation' in error && error.validation) {
    return {
      statusCode: 400,
      response: {
        error: 'VALIDATION_ERROR',
        message: error.message,
      },
    }
  }

  if ('statusCode' in error && typeof error.statusCode === 'number') {
    // Only propagate the original message for expected client errors (4xx).
    // Server errors (5xx) get a generic message to avoid leaking internals.
    const isServerError = error.statusCode >= 500
    return {
      statusCode: error.statusCode,
      response: {
        error: isServerError ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
        message: isServerError ? 'An unexpected error occurred' : error.message,
      },
    }
  }

  return {
    statusCode: 500,
    response: {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  }
}

/** Request path without its query string, which may carry tokens or other user input. */
function requestPath(request: FastifyRequest): string {
  const [path = request.url] = request.url.split('?')
  return path
}

function logError(
  fastify: FastifyInstance,
  error: Error,
  request: FastifyRequest,
  statusCode: number
): void {
  const context = { method: request.method, path: requestPath(request), statusCode }

  // A response that broke its contract is reported by issue path and code only:
  // the error object carries the full request URL and is never logged itself.
  if (error instanceof ResponseSerializationError) {
    fastify.log.error(
      {
        ...context,
        code: 'RESPONSE_CONTRACT_VIOLATION',
        issues: describeContractIssues(new ZodError(error.cause.issues)),
      },
      'Response does not match its contract'
    )
    return
  }

  if (statusCode === 500) {
    fastify.log.error(error, 'Unhandled error')
  }

  if (process.env.NODE_ENV !== 'production') {
    fastify.log.error({ err: error, ...context })
  }
}

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.setErrorHandler((error: FastifyError | Error, request, reply) => {
    const { statusCode, response } = parseError(error)
    logError(fastify, error, request, statusCode)
    return reply.status(statusCode).send(response)
  })
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
  fastify: '5.x',
})
