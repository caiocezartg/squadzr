import type { Clock } from '@domain/services/clock.interface'
import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'
import { OwnerAlreadyExistsError, UserNotFoundError } from '@application/errors'

export type GrantableRole = 'admin' | 'owner'

export interface GrantAdminInput {
  /** A user id, or else a Discord account id. */
  readonly identifier: string
  /** The role to give; `admin` unless the operator asks for the owner. */
  readonly role?: GrantableRole
}

export interface GrantAdminOutput {
  readonly user: User
  readonly role: GrantableRole
  /** False when the person already held the role (or a higher one): nothing changed and no entry was written. */
  readonly granted: boolean
}

export interface IGrantAdminUseCase {
  execute(input: GrantAdminInput): Promise<GrantAdminOutput>
}

/**
 * The operator's way to the first admin and to the owner (the `admin:grant` script). It is idempotent
 * and it never demotes: an admin or the owner granted `admin` stays as they are, the owner granted
 * `owner` stays the owner, and a second owner is refused. Granting writes one `admin_granted` entry
 * with no actor, which the panel shows as "System".
 */
export class GrantAdminUseCase implements IGrantAdminUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: GrantAdminInput): Promise<GrantAdminOutput> {
    const role = input.role ?? 'admin'
    const person = await this.userRepository.findByIdOrDiscordId(input.identifier)
    if (!person) throw new UserNotFoundError(input.identifier)
    if (alreadyHolds(person.role, role)) return { user: person, role, granted: false }

    if (role === 'owner') {
      const owner = await this.userRepository.findOwner()
      if (owner && owner.id !== person.id) throw new OwnerAlreadyExistsError(owner.name, owner.id)
    }

    const granted = await this.userRepository.grantRole(person.id, role, {
      actorId: null,
      actorName: null,
      action: 'admin_granted',
      target: { type: 'user', id: person.id, name: person.name },
      reason: null,
      details: { oldRole: person.role, newRole: role },
      createdAt: this.clock.now(),
    })

    return { user: granted ? { ...person, role } : person, role, granted }
  }
}

/** Granting `admin` leaves an admin and the owner alone; granting `owner` leaves the owner alone. */
function alreadyHolds(current: User['role'], role: GrantableRole): boolean {
  return role === 'owner' ? current === 'owner' : current === 'admin' || current === 'owner'
}
