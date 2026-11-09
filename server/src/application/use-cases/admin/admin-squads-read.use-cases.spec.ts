import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PAGE_SIZE } from '@squadzr/schemas'
import { RoomNotFoundError } from '@application/errors'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'
import { GetAdminSquadUseCase } from './get-admin-squad.use-case'
import { ListAdminSquadsUseCase } from './list-admin-squads.use-case'

type MockRepository = { [K in keyof IAdminSquadRepository]: ReturnType<typeof vi.fn> }

describe('admin Squads read use cases', () => {
  let repository: MockRepository

  beforeEach(() => {
    repository = { listOpen: vi.fn(), findOpenById: vi.fn(), closeOpenSquad: vi.fn() }
  })

  describe('ListAdminSquadsUseCase', () => {
    it('turns the 1-based page into a window of the shared page size', async () => {
      repository.listOpen.mockResolvedValue({ squads: [], total: 41 })
      const useCase = new ListAdminSquadsUseCase(repository as unknown as IAdminSquadRepository)

      const result = await useCase.execute({
        page: 3,
        q: 'vlr',
        gameId: 'game-1',
        platform: 'ps5',
        language: 'en',
        sort: 'stale',
      })

      expect(repository.listOpen).toHaveBeenCalledWith({
        offset: 2 * PAGE_SIZE,
        limit: PAGE_SIZE,
        sort: 'stale',
        search: 'vlr',
        gameId: 'game-1',
        platform: 'ps5',
        language: 'en',
      })
      expect(result).toEqual({ squads: [], page: 3, pageSize: PAGE_SIZE, total: 41 })
    })

    it('passes no filter when none is given', async () => {
      repository.listOpen.mockResolvedValue({ squads: [], total: 0 })
      const useCase = new ListAdminSquadsUseCase(repository as unknown as IAdminSquadRepository)

      await useCase.execute({ page: 1 })

      expect(repository.listOpen).toHaveBeenCalledWith({
        offset: 0,
        limit: PAGE_SIZE,
        sort: 'newest',
      })
    })
  })

  describe('GetAdminSquadUseCase', () => {
    it('returns the Open Squad', async () => {
      const squad = { id: 'room-1' }
      repository.findOpenById.mockResolvedValue(squad)
      const useCase = new GetAdminSquadUseCase(repository as unknown as IAdminSquadRepository)

      expect(await useCase.execute({ roomId: 'room-1' })).toBe(squad)
    })

    it('answers 404 for a Squad that is unknown, Ready or expired', async () => {
      repository.findOpenById.mockResolvedValue(null)
      const useCase = new GetAdminSquadUseCase(repository as unknown as IAdminSquadRepository)

      await expect(useCase.execute({ roomId: 'room-1' })).rejects.toBeInstanceOf(RoomNotFoundError)
    })
  })
})
