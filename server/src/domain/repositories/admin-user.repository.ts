import type {
  AdminUser,
  AdminUserCompletedSquad,
  AdminUserListItem,
  AdminUserOpenSquad,
} from '@domain/entities/admin-user.entity'

export interface AdminUserPage {
  readonly items: AdminUserListItem[]
  /** Every user the search matches, not only this page's. */
  readonly total: number
}

export interface ChangeRoleCommand {
  readonly actorId: string
  readonly targetId: string
  readonly role: AdminUser['role']
  /** The instant of the change and of its Audit Entry. */
  readonly now: Date
}

/** Why a role change was refused, in the order the rules apply. */
export type RoleChangeRefusal = 'actor_not_admin' | 'user_not_found' | 'own_role' | 'last_admin'

export type RoleChangeOutcome =
  | { readonly status: 'changed' }
  /** The target already had the role: nothing changed and no Audit Entry was written. */
  | { readonly status: 'unchanged' }
  | { readonly status: 'refused'; readonly reason: RoleChangeRefusal }

export interface IAdminUserRepository {
  /**
   * Users newest first, `limit` of them after `offset`. A search matches the name by any part of it
   * (case-insensitive), or a Discord id or a user id exactly; an absent or empty one matches everyone.
   */
  list(search: string | undefined, offset: number, limit: number, now: Date): Promise<AdminUserPage>
  findById(id: string): Promise<AdminUser | null>
  /** The valid Open Squads the person is a member of, newest first. */
  findOpenSquads(userId: string, now: Date): Promise<AdminUserOpenSquad[]>
  /** The person's latest completed Squads from their Squad Records, newest first. */
  findLatestCompleted(userId: string, limit: number): Promise<AdminUserCompletedSquad[]>
  /**
   * Sets a role inside one transaction that locks every admin row (and the actor's and the target's),
   * re-reads the actor's role and applies the rules in order (see `decideRoleChange`). A change and its
   * `role_changed` Audit Entry commit together; a refusal or a no-op writes nothing.
   */
  changeRole(command: ChangeRoleCommand): Promise<RoleChangeOutcome>
}
