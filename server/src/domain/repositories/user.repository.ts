import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type { User } from '@domain/entities/user.entity'

export interface IUserRepository {
  findById(id: string): Promise<User | null>
  findByIds(ids: string[]): Promise<User[]>
  /**
   * The person whose user id is `identifier`, or else whose Discord account id is. The user id wins,
   * so an id that happens to match both reads as the user.
   */
  findByIdOrDiscordId(identifier: string): Promise<User | null>
  /** The one owner, or null when none has been made. The database allows at most one. */
  findOwner(): Promise<User | null>
  /**
   * Gives the person `admin` (a `user` or `moderator` becomes one; an admin or the owner is never
   * touched) or `owner` (anyone but the owner becomes the owner) and writes `audit` in the same
   * transaction. True when the role changed; false when there was nothing to change, in which case
   * nothing is written.
   */
  grantRole(userId: string, role: 'admin' | 'owner', audit: NewAuditEntry): Promise<boolean>
}
