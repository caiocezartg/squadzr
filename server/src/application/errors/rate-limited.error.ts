import { AppError } from './base.error'

/** A caller asked more often than the route allows; they can ask again once their window passes. */
export class RateLimitedError extends AppError {
  readonly statusCode = 429
  readonly code = 'RATE_LIMITED'

  constructor(message = 'Too many requests. Try again shortly.') {
    super(message)
  }
}
