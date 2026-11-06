import type { UserRole } from '@squadzr/schemas'

/** What the role change is decided on, read under the lock on the admin rows. */
export interface RoleChangeFacts {
  readonly actorId: string
  /** The actor's role as just re-read; null when the account is gone. */
  readonly actorRole: UserRole | null
  readonly targetId: string
  /** The target's role; null when no such user exists. */
  readonly targetRole: UserRole | null
  readonly newRole: UserRole
  /** How many admins there are right now, the actor and the target included. */
  readonly adminCount: number
}

export type RoleChangeDecision =
  | 'actor_not_admin'
  | 'user_not_found'
  | 'own_role'
  | 'unchanged'
  | 'last_admin'
  | 'change'

/**
 * The role change rules, in the order they apply: an actor who is no longer an admin is refused first
 * (the role is re-read, so a demotion that landed a moment ago counts), then an unknown user, then the
 * actor's own role, then a role the target already has (a no-op), and last a demotion that would leave
 * no admin at all.
 */
export function decideRoleChange(facts: RoleChangeFacts): RoleChangeDecision {
  if (facts.actorRole !== 'admin') return 'actor_not_admin'
  if (facts.targetRole === null) return 'user_not_found'
  if (facts.targetId === facts.actorId) return 'own_role'
  if (facts.targetRole === facts.newRole) return 'unchanged'
  // Defense in depth: through the endpoint an admin actor demoting a distinct admin implies two admins
  // at least, so this never fires there. The rule itself is covered by role-change.spec.ts.
  if (facts.targetRole === 'admin' && facts.adminCount <= 1) return 'last_admin'
  return 'change'
}
