import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomNotFoundError, RoomNotOpenError } from '@application/errors'
import type { IAdminSquadRepository } from '@domain/repositories/admin-squad.repository'
import { CloseSquadUseCase } from './close-squad.use-case'

const ROOM_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const actor = { id: 'admin-1', name: 'Ana' }

type MockRepository = { [K in keyof IAdminSquadRepository]: ReturnType<typeof vi.fn> }

describe('CloseSquadUseCase', () => {
  let repository: MockRepository
  let useCase: CloseSquadUseCase

  beforeEach(() => {
    repository = { listOpen: vi.fn(), findOpenById: vi.fn(), closeOpenSquad: vi.fn() }
    useCase = new CloseSquadUseCase(repository as unknown as IAdminSquadRepository)
  })

  it('returns what the closure persisted, for the broadcasts after commit', async () => {
    const notifications = [{ id: 'n-1' }]
    repository.closeOpenSquad.mockResolvedValue({
      status: 'closed',
      roomId: ROOM_ID,
      roomCode: 'VLR7K2',
      notifications,
    })

    const result = await useCase.execute({ roomId: ROOM_ID, reason: 'Spam', actor })

    expect(result).toEqual({ roomId: ROOM_ID, roomCode: 'VLR7K2', notifications })
    expect(repository.closeOpenSquad).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: ROOM_ID })
    )
  })

  it('hands the repository builders that carry the reason and the actor', async () => {
    repository.closeOpenSquad.mockResolvedValue({ status: 'not_found' })
    await useCase.execute({ roomId: ROOM_ID, reason: 'Spam', actor }).catch(() => undefined)

    const input = repository.closeOpenSquad.mock.calls[0]?.[0] as Parameters<
      IAdminSquadRepository['closeOpenSquad']
    >[0]
    const squad = {
      roomId: ROOM_ID,
      roomCode: 'VLR7K2',
      roomName: 'Ranked',
      gameName: 'Valorant',
      memberIds: ['host-1'],
    }
    const closedAt = new Date('2026-11-05T12:00:00.000Z')

    expect(input.buildNotifications(squad)[0]).toMatchObject({
      userId: 'host-1',
      type: 'room_closed_by_admin',
      payload: { reason: 'Spam' },
    })
    expect(input.buildAuditEntry(squad, closedAt)).toMatchObject({
      actorId: 'admin-1',
      action: 'squad_closed',
      reason: 'Spam',
      createdAt: closedAt,
    })
  })

  it('answers 404 for a Squad that is unknown or already deleted', async () => {
    repository.closeOpenSquad.mockResolvedValue({ status: 'not_found' })

    await expect(
      useCase.execute({ roomId: ROOM_ID, reason: 'Spam', actor })
    ).rejects.toBeInstanceOf(RoomNotFoundError)
  })

  it('answers 422 ROOM_NOT_OPEN for a Ready or expired Squad', async () => {
    repository.closeOpenSquad.mockResolvedValue({ status: 'not_open' })

    const error = await useCase
      .execute({ roomId: ROOM_ID, reason: 'Spam', actor })
      .catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(RoomNotOpenError)
    expect(error).toMatchObject({ statusCode: 422, code: 'ROOM_NOT_OPEN' })
  })
})
