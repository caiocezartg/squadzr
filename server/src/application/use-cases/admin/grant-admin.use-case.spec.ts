import { beforeEach, describe, expect, it } from 'vitest'
import { GrantAdminUseCase } from './grant-admin.use-case'
import { UserNotFoundError } from '@application/errors'
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
    expect(repository.grantAdmin).toHaveBeenCalledWith('user-1', {
      actorId: null,
      actorName: null,
      action: 'admin_granted',
      target: { type: 'user', id: 'user-1', name: 'Caio' },
      reason: null,
      details: { oldRole: 'user', newRole: 'admin' },
      createdAt: now,
    })
  })

  it('changes nothing for an admin', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(createMockUser({ role: 'admin' }))

    const result = await useCase.execute({ identifier: 'user-1' })

    expect(result.granted).toBe(false)
    expect(repository.grantAdmin).not.toHaveBeenCalled()
  })

  it('reports a person who lost the race as not granted', async () => {
    repository.findByIdOrDiscordId.mockResolvedValue(createMockUser({ role: 'user' }))
    repository.grantAdmin.mockResolvedValue(false)

    expect((await useCase.execute({ identifier: 'user-1' })).granted).toBe(false)
  })

  it('refuses an unknown id', async () => {
    const error = await useCase.execute({ identifier: 'nobody' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(UserNotFoundError)
    expect(repository.grantAdmin).not.toHaveBeenCalled()
  })
})
