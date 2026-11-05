import { AppError } from './base.error'

/** An admin tried to change their own role; the rule holds on the server, whatever the UI shows. */
export class CannotChangeOwnRoleError extends AppError {
  readonly statusCode = 422
  readonly code = 'CANNOT_CHANGE_OWN_ROLE'

  constructor() {
    super('You cannot change your own role')
  }
}

/** A demotion that would leave the panel with no admin. */
export class LastAdminError extends AppError {
  readonly statusCode = 422
  readonly code = 'LAST_ADMIN'

  constructor() {
    super('At least one admin must remain')
  }
}
