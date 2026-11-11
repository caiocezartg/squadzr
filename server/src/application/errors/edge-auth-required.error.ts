import { AppError } from './base.error'

/** A request that did not come through the edge, on an API that only answers requests the edge forwarded. */
export class EdgeAuthRequiredError extends AppError {
  readonly statusCode = 403
  readonly code = 'EDGE_AUTH_REQUIRED'

  constructor(message = 'Request did not come through the edge') {
    super(message)
  }
}
