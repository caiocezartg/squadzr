import { AppError } from './base.error'

/** A signed-in person without the role a `/api/admin/*` route asks for (a panel role, or admin or owner) asked for it. */
export class AdminRequiredError extends AppError {
  readonly statusCode = 403
  readonly code = 'ADMIN_REQUIRED'

  constructor(message = 'Administrator access required') {
    super(message)
  }
}
