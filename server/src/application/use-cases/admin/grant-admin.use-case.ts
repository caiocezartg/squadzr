import type { Clock } from '@domain/services/clock.interface'
import type { User } from '@domain/entities/user.entity'
import type { IUserRepository } from '@domain/repositories/user.repository'
import { UserNotFoundError } from '@application/errors'

export interface GrantAdminInput {
  /** A user id, or else a Discord account id. */
  readonly identifier: string
}

export interface GrantAdminOutput {
  readonly user: User
  /** False when the person was already an admin: nothing changed and no entry was written. */
  readonly granted: boolean
}

export interface IGrantAdminUseCase {
  execute(input: GrantAdminInput): Promise<GrantAdminOutput>
}

/**
 * The operator's way to the first admin (the `admin:grant` script). It is idempotent and it never
 * demotes: an admin stays an admin, and granting a user writes one `admin_granted` entry with no
 * actor, which the panel shows as "System".
 */
export class GrantAdminUseCase implements IGrantAdminUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: GrantAdminInput): Promise<GrantAdminOutput> {
    const person = await this.userRepository.findByIdOrDiscordId(input.identifier)
    if (!person) throw new UserNotFoundError(input.identifier)
    if (person.role === 'admin') return { user: person, granted: false }

    const granted = await this.userRepository.grantAdmin(person.id, {
      actorId: null,
      actorName: null,
      action: 'admin_granted',
      target: { type: 'user', id: person.id, name: person.name },
      reason: null,
      details: { oldRole: person.role, newRole: 'admin' },
      createdAt: this.clock.now(),
    })

    return { user: { ...person, role: 'admin' }, granted }
  }
}
