import type { UserRole } from '@squadzr/schemas'
import type { AdminUser } from '@domain/entities/admin-user.entity'
import type {
  IAdminUserRepository,
  RoleChangeRefusal,
} from '@domain/repositories/admin-user.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { AppError } from '@application/errors'
import {
  AdminRequiredError,
  CannotChangeOwnRoleError,
  LastAdminError,
  UserNotFoundError,
} from '@application/errors'

export interface ChangeUserRoleInput {
  readonly actorId: string
  readonly targetId: string
  readonly role: UserRole
}

export interface ChangeUserRoleOutput {
  readonly user: AdminUser
  /** False when the person already had the role: nothing changed and no Audit Entry was written. */
  readonly changed: boolean
}

export interface IChangeUserRoleUseCase {
  execute(input: ChangeUserRoleInput): Promise<ChangeUserRoleOutput>
}

function refusalError(reason: RoleChangeRefusal, targetId: string): AppError {
  switch (reason) {
    case 'actor_not_admin':
      return new AdminRequiredError()
    case 'user_not_found':
      return new UserNotFoundError(targetId)
    case 'own_role':
      return new CannotChangeOwnRoleError()
    case 'last_admin':
      return new LastAdminError()
  }
}

/**
 * Promotes or demotes a user. The rules (the actor is still an admin, the user exists, nobody changes
 * their own role, the last admin stays) are applied by the repository inside the transaction that
 * locks the admin rows, so two admins demoting each other at once leave exactly one admin; this maps
 * a refusal to its error.
 */
export class ChangeUserRoleUseCase implements IChangeUserRoleUseCase {
  constructor(
    private readonly adminUserRepository: IAdminUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: ChangeUserRoleInput): Promise<ChangeUserRoleOutput> {
    const outcome = await this.adminUserRepository.changeRole({ ...input, now: this.clock.now() })
    if (outcome.status === 'refused') throw refusalError(outcome.reason, input.targetId)

    const user = await this.adminUserRepository.findById(input.targetId)
    if (!user) throw new UserNotFoundError(input.targetId)

    return { user, changed: outcome.status === 'changed' }
  }
}
