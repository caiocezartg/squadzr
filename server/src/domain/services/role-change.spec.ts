import { describe, expect, it } from 'vitest'
import { decideRoleChange, type RoleChangeFacts } from './role-change'

const facts: RoleChangeFacts = {
  actorId: 'actor',
  actorRole: 'admin',
  targetId: 'target',
  targetRole: 'user',
  newRole: 'admin',
}

describe('decideRoleChange', () => {
  it('lets the owner change anyone else among user, moderator and admin', () => {
    const owner = { ...facts, actorRole: 'owner' as const }
    expect(decideRoleChange(owner)).toBe('change')
    expect(decideRoleChange({ ...owner, targetRole: 'admin', newRole: 'user' })).toBe('change')
    expect(decideRoleChange({ ...owner, targetRole: 'admin', newRole: 'moderator' })).toBe('change')
    expect(decideRoleChange({ ...owner, targetRole: 'moderator', newRole: 'admin' })).toBe('change')
  })

  it('lets an admin change user and moderator accounts to user, moderator or admin', () => {
    expect(decideRoleChange(facts)).toBe('change')
    expect(decideRoleChange({ ...facts, targetRole: 'moderator', newRole: 'admin' })).toBe('change')
    expect(decideRoleChange({ ...facts, targetRole: 'moderator', newRole: 'user' })).toBe('change')
  })

  it('refuses an actor who is no longer an admin or owner, or whose account is gone, before anything else', () => {
    expect(decideRoleChange({ ...facts, actorRole: 'moderator', targetRole: null })).toBe(
      'actor_not_admin'
    )
    expect(decideRoleChange({ ...facts, actorRole: 'user' })).toBe('actor_not_admin')
    expect(decideRoleChange({ ...facts, actorRole: null })).toBe('actor_not_admin')
  })

  it('refuses an unknown user before the actor-is-target rule', () => {
    expect(decideRoleChange({ ...facts, targetRole: null, targetId: 'actor' })).toBe(
      'user_not_found'
    )
  })

  it('refuses the actor changing their own role, before the owner rules', () => {
    expect(decideRoleChange({ ...facts, targetId: 'actor', targetRole: 'admin' })).toBe('own_role')
    expect(
      decideRoleChange({
        ...facts,
        actorRole: 'owner',
        targetId: 'actor',
        targetRole: 'owner',
        newRole: 'user',
      })
    ).toBe('own_role')
  })

  it('refuses changing the owner for everyone, before the forbidden rule', () => {
    expect(decideRoleChange({ ...facts, actorRole: 'owner', targetRole: 'owner' })).toBe(
      'target_is_owner'
    )
    expect(decideRoleChange({ ...facts, targetRole: 'owner', newRole: 'user' })).toBe(
      'target_is_owner'
    )
  })

  it('refuses an admin acting on another admin, even to the role the admin holds', () => {
    expect(decideRoleChange({ ...facts, targetRole: 'admin', newRole: 'user' })).toBe('forbidden')
    expect(decideRoleChange({ ...facts, targetRole: 'admin', newRole: 'admin' })).toBe('forbidden')
  })

  it('refuses handing out the owner role, whoever asks', () => {
    expect(decideRoleChange({ ...facts, newRole: 'owner' })).toBe('forbidden')
    expect(decideRoleChange({ ...facts, actorRole: 'owner', newRole: 'owner' })).toBe('forbidden')
  })

  it('treats the role the target already has as a no-op once the actor may act', () => {
    expect(decideRoleChange({ ...facts, targetRole: 'user', newRole: 'user' })).toBe('unchanged')
    expect(
      decideRoleChange({ ...facts, actorRole: 'owner', targetRole: 'admin', newRole: 'admin' })
    ).toBe('unchanged')
  })
})
