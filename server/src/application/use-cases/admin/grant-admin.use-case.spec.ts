import { beforeEach, describe, expect, it } from 'vitest'
import { GrantAdminUseCase } from './grant-admin.use-case'
import { OwnerAlreadyExistsError, UserNotFoundError } from '@application/errors'
import { createMockUser, createMockUserRepository } from '@test/mocks'
import { createMockClock } from '@test/mocks/clock.mock'

describe('GrantAdminUseCase', () => {
  const now = new Date('2026-11-04T09:00:00.000Z')
  let repository: ReturnType<typeof createMockUserRepository>
  let useCase: GrantAdminUseCase

  beforeEach(() => {
    repository = createMockUserRepository()
    useCase = new GrantAdminUseCase(repository, createMockClock(now))
  })

  it('grants a user and records a System entry with the old and new role', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(
      createMockUser({ id: 'user-1', name: 'Caio', role: 'user' })
    )

    const result = await useCase.execute({ identifier: 'user-1' })

    expect(result).toMatchObject({ granted: true, user: { id: 'user-1', role: 'admin' } })
    expect(repository.grantRole).toHaveBeenCalledWith('user-1', 'admin', {
      actorId: null,
      actorName: null,
      action: 'admin_granted',
      target: { type: 'user', id: 'user-1', name: 'Caio' },
      reason: null,
      details: { oldRole: 'user', newRole: 'admin' },
      createdAt: now,
    })
  })

  it.each(['admin', 'owner'] as const)(
    'changes nothing for an %s asked to be an admin',
    async (role) => {
      repository.findByIdOrDiscordId.mockResolvedValue(createMockUser({ role }))

      const result = await useCase.execute({ identifier: 'user-1' })

      expect(result.granted).toBe(false)
      expect(result.user.role).toBe(role)
      expect(repository.grantRole).not.toHaveBeenCalled()
    }
  )

  it('promotes a moderator to admin', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(
      createMockUser({ id: 'user-1', role: 'moderator' })
    )

    const result = await useCase.execute({ identifier: 'user-1' })

    expect(result).toMatchObject({ granted: true, user: { role: 'admin' } })
  })

  it('makes the owner when there is none and records the old role', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(
      createMockUser({ id: 'user-1', name: 'Caio', role: 'admin' })
    )

    const result = await useCase.execute({ identifier: 'user-1', role: 'owner' })

    expect(result).toMatchObject({ granted: true, role: 'owner', user: { role: 'owner' } })
    expect(repository.grantRole).toHaveBeenCalledWith(
      'user-1',
      'owner',
      expect.objectContaining({ details: { oldRole: 'admin', newRole: 'owner' } })
    )
  })

  it('changes nothing for the person who already is the owner', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(
      createMockUser({ id: 'user-1', role: 'owner' })
    )

    const result = await useCase.execute({ identifier: 'user-1', role: 'owner' })

    expect(result.granted).toBe(false)
    expect(repository.findOwner).not.toHaveBeenCalled()
    expect(repository.grantRole).not.toHaveBeenCalled()
  })

  it('refuses a second owner and writes nothing', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(createMockUser({ id: 'user-2', role: 'user' }))
    repository.findOwner.mockResolvedValue(
      createMockUser({ id: 'user-1', name: 'Caio', role: 'owner' })
    )

    const error = await useCase
      .execute({ identifier: 'user-2', role: 'owner' })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(OwnerAlreadyExistsError)
    expect(repository.grantRole).not.toHaveBeenCalled()
  })

  it('reports a person who lost the race as not granted', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(createMockUser({ role: 'user' }))
    repository.grantRole.mockResolvedValue('unchanged')

    expect((await useCase.execute({ identifier: 'user-1' })).granted).toBe(false)
  })

  it('refuses an unknown id', async () => {
    const error = await useCase.execute({ identifier: 'nobody' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(UserNotFoundError)
    expect(repository.grantRole).not.toHaveBeenCalled()
  })
})
