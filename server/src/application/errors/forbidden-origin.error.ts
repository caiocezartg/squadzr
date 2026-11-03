import { AppError } from './base.error'

/** A browser request that changes state, or opens a WebSocket, from a site other than the app. */
export class ForbiddenOriginError extends AppError {
  readonly statusCode = 403
  readonly code = 'FORBIDDEN_ORIGIN'

  constructor(message = 'Request origin is not allowed') {
    super(message)
  }
}
