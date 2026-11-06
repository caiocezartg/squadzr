import { AppError } from './base.error'

/** An admin tried to change their own role; the rule holds on the server, whatever the UI shows. */
export class CannotChangeOwnRoleError extends AppError {
  readonly statusCode = 422
  readonly code = 'CANNOT_CHANGE_OWN_ROLE'

  constructor() {
    super('You cannot change your own role')
  }
}

/** The target is the owner, whose role nobody changes. */
export class CannotChangeOwnerError extends AppError {
  readonly statusCode = 422
  readonly code = 'CANNOT_CHANGE_OWNER'

  constructor() {
    super("The owner's role cannot be changed")
  }
}

/**
 * The actor is an admin or the owner but their role does not allow this change: an admin acting on
 * another admin, or a role the actor may not hand out.
 */
export class RoleChangeForbiddenError extends AppError {
  readonly statusCode = 403
  readonly code = 'ROLE_CHANGE_FORBIDDEN'

  constructor() {
    super('Your role does not allow this role change')
  }
}

/** The owner script was asked to make a second owner; there is at most one. */
export class OwnerAlreadyExistsError extends AppError {
  readonly statusCode = 409
  readonly code = 'OWNER_ALREADY_EXISTS'

  constructor(
    readonly ownerName: string,
    readonly ownerId: string
  ) {
    super(`${ownerName} (${ownerId}) is already the owner`)
  }
}
