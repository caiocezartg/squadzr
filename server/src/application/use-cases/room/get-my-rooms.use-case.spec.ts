import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GetMyRoomsUseCase } from './get-my-rooms.use-case'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import { createMockClock, FIXED_NOW } from '@test/mocks'

describe('GetMyRoomsUseCase', () => {
  let mockRoomRepo: { findMyRooms: ReturnType<typeof vi.fn> }
  let clock: ReturnType<typeof createMockClock>
  let useCase: GetMyRoomsUseCase

  beforeEach(() => {
    mockRoomRepo = { findMyRooms: vi.fn() }
    clock = createMockClock()
    useCase = new GetMyRoomsUseCase(mockRoomRepo as unknown as IRoomRepository, clock)
  })

  it('should return hosted and joined rooms for a user at the injected instant', async () => {
    const mockResult = {
      hosted: [{ id: '1', name: 'My Room', memberCount: 2, isMember: true }],
      joined: [{ id: '2', name: 'Other Room', memberCount: 3, isMember: true }],
    }
    mockRoomRepo.findMyRooms.mockResolvedValue(mockResult)

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result).toEqual(mockResult)
    expect(mockRoomRepo.findMyRooms).toHaveBeenCalledWith('user-1', FIXED_NOW)
  })

  it('should return empty arrays when user has no rooms', async () => {
    mockRoomRepo.findMyRooms.mockResolvedValue({ hosted: [], joined: [] })

    const result = await useCase.execute({ userId: 'user-1' })

    expect(result.hosted).toHaveLength(0)
    expect(result.joined).toHaveLength(0)
    expect(mockRoomRepo.findMyRooms).toHaveBeenCalledWith('user-1', FIXED_NOW)
  })
})
