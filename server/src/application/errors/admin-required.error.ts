import { AppError } from './base.error'

/** A signed-in person without the admin role asked for an admin route. */
export class AdminRequiredError extends AppError {
  readonly statusCode = 403
  readonly code = 'ADMIN_REQUIRED'

  constructor(message = 'Administrator access required') {
    super(message)
  }
}
