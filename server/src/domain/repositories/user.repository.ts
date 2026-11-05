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
  /**
   * Makes the person an admin and writes `audit` in the same transaction. True when the role changed;
   * false when they were already an admin, in which case nothing is written.
   */
  grantAdmin(userId: string, audit: NewAuditEntry): Promise<boolean>
}
