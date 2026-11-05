import { beforeEach, describe, expect, it } from 'vitest'
import {
  AdminRequiredError,
  CannotChangeOwnRoleError,
  LastAdminError,
  UserNotFoundError,
} from '@application/errors'
import type { RoleChangeRefusal } from '@domain/repositories/admin-user.repository'
import {
  createMockAdminUser,
  createMockAdminUserRepository,
  createMockClock,
  type MockAdminUserRepository,
} from '@test/mocks'
import { ChangeUserRoleUseCase } from './change-user-role.use-case'

// The rules themselves are decided in the repository's transaction (domain/services/role-change.ts and
// tests/integration/admin-users-http.test.ts); this use case maps their outcome.

const NOW = new Date('2026-11-05T12:00:00.000Z')
const input = { actorId: 'admin-1', targetId: 'user-2', role: 'admin' } as const

describe('ChangeUserRoleUseCase', () => {
  let repository: MockAdminUserRepository
  let useCase: ChangeUserRoleUseCase

  beforeEach(() => {
    repository = createMockAdminUserRepository()
    useCase = new ChangeUserRoleUseCase(repository, createMockClock(NOW))
  })

  it('asks the repository for the change at the clock instant and returns the user with the new role', async () => {
    repository.changeRole.mockResolvedValue({ status: 'changed' })
    repository.findById.mockResolvedValue(createMockAdminUser({ id: 'user-2', role: 'admin' }))

    const result = await useCase.execute(input)

    expect(repository.changeRole).toHaveBeenCalledWith({ ...input, now: NOW })
    expect(result.changed).toBe(true)
    expect(result.user).toMatchObject({ id: 'user-2', role: 'admin' })
  })

  it('reports a role the person already had as unchanged', async () => {
    repository.changeRole.mockResolvedValue({ status: 'unchanged' })
    repository.findById.mockResolvedValue(createMockAdminUser({ id: 'user-2', role: 'admin' }))

    const result = await useCase.execute(input)

    expect(result.changed).toBe(false)
  })

  it.each<[RoleChangeRefusal, new (...args: never[]) => Error]>([
    ['actor_not_admin', AdminRequiredError],
    ['user_not_found', UserNotFoundError],
    ['own_role', CannotChangeOwnRoleError],
    ['last_admin', LastAdminError],
  ])('turns the refusal %s into its error', async (reason, errorClass) => {
    repository.changeRole.mockResolvedValue({ status: 'refused', reason })

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(errorClass)
    expect(repository.findById).not.toHaveBeenCalled()
  })

  it('answers unknown user when the person disappears before the answer is read', async () => {
    repository.changeRole.mockResolvedValue({ status: 'changed' })
    repository.findById.mockResolvedValue(null)

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(UserNotFoundError)
  })

  it('gives the new errors a 422 and their own codes', () => {
    expect(new CannotChangeOwnRoleError()).toMatchObject({
      statusCode: 422,
      code: 'CANNOT_CHANGE_OWN_ROLE',
    })
    expect(new LastAdminError()).toMatchObject({ statusCode: 422, code: 'LAST_ADMIN' })
  })
})
