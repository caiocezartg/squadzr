import { describe, expect, it } from 'vitest'
import { decideRoleChange, type RoleChangeFacts } from './role-change'

const facts: RoleChangeFacts = {
  actorId: 'actor',
  actorRole: 'admin',
  targetId: 'target',
  targetRole: 'user',
  newRole: 'admin',
  adminCount: 1,
}

describe('decideRoleChange', () => {
  it('promotes a user and demotes another admin', () => {
    expect(decideRoleChange(facts)).toBe('change')
    expect(
      decideRoleChange({ ...facts, targetRole: 'admin', newRole: 'user', adminCount: 2 })
    ).toBe('change')
  })

  it('refuses an actor who is no longer an admin, or whose account is gone, before anything else', () => {
    expect(decideRoleChange({ ...facts, actorRole: 'user', targetRole: null })).toBe(
      'actor_not_admin'
    )
    expect(decideRoleChange({ ...facts, actorRole: null })).toBe('actor_not_admin')
  })

  it('refuses an unknown user before the actor-is-target rule', () => {
    expect(decideRoleChange({ ...facts, targetRole: null, targetId: 'actor' })).toBe(
      'user_not_found'
    )
  })

  it('refuses the actor changing their own role, even to the role they hold', () => {
    expect(decideRoleChange({ ...facts, targetId: 'actor', targetRole: 'admin' })).toBe('own_role')
    expect(
      decideRoleChange({ ...facts, targetId: 'actor', targetRole: 'admin', newRole: 'user' })
    ).toBe('own_role')
  })

  it('treats the role the target already has as a no-op, before the last-admin rule', () => {
    expect(decideRoleChange({ ...facts, targetRole: 'user', newRole: 'user' })).toBe('unchanged')
    expect(
      decideRoleChange({ ...facts, targetRole: 'admin', newRole: 'admin', adminCount: 1 })
    ).toBe('unchanged')
  })

  it('refuses a demotion that would leave no admin', () => {
    expect(
      decideRoleChange({ ...facts, targetRole: 'admin', newRole: 'user', adminCount: 1 })
    ).toBe('last_admin')
  })
})
