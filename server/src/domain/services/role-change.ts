import { grantableRoles, type UserRole } from '@squadzr/schemas'

/** What the role change is decided on, read under the lock on the actor's and the target's rows. */
export interface RoleChangeFacts {
  readonly actorId: string
  /** The actor's role as just re-read; null when the account is gone. */
  readonly actorRole: UserRole | null
  readonly targetId: string
  /** The target's role; null when no such user exists. */
  readonly targetRole: UserRole | null
  readonly newRole: UserRole
}

export type RoleChangeDecision =
  | 'actor_not_admin'
  | 'user_not_found'
  | 'own_role'
  | 'target_is_owner'
  | 'forbidden'
  | 'unchanged'
  | 'change'

/**
 * The role change rules, in the order they apply:
 *
 * 1. The actor, as just re-read, is an admin or the owner. A demotion that landed a moment ago counts,
 *    and so does an account that is gone (`actor_not_admin`, 403 `ADMIN_REQUIRED`).
 * 2. The target exists (`user_not_found`).
 * 3. The target is not the actor: nobody changes their own role (`own_role`).
 * 4. The target is not the owner: nobody changes the owner's role (`target_is_owner`).
 * 5. The actor may act on this target and hand out the requested role (`forbidden`): the owner changes
 *    anyone else, an admin only `user` and `moderator` accounts, and `owner` is never handed out.
 * 6. A role the target already has is a no-op, with no Audit Entry (`unchanged`).
 */
export function decideRoleChange(facts: RoleChangeFacts): RoleChangeDecision {
  if (facts.actorRole !== 'admin' && facts.actorRole !== 'owner') return 'actor_not_admin'
  if (facts.targetRole === null) return 'user_not_found'
  if (facts.targetId === facts.actorId) return 'own_role'
  if (facts.targetRole === 'owner') return 'target_is_owner'
  const allowed = grantableRoles(facts.actorRole, facts.targetRole)
  if (!allowed.some((role) => role === facts.newRole)) return 'forbidden'
  if (facts.targetRole === facts.newRole) return 'unchanged'
  return 'change'
}
