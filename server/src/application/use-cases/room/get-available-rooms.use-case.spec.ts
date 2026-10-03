import { describe, it, expect, beforeEach } from 'vitest'
import { GetAvailableRoomsUseCase } from './get-available-rooms.use-case'
import {
  createMockClock,
  createMockRoom,
  createMockRoomRepository,
  createMockRoomMemberRepository,
  createMockRoomMember,
  FIXED_NOW,
} from '@test/mocks'

describe('GetAvailableRoomsUseCase', () => {
  let useCase: GetAvailableRoomsUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    clock = createMockClock()
    useCase = new GetAvailableRoomsUseCase(mockRoomRepository, mockRoomMemberRepository, clock)
  })

  describe('execute', () => {
    it('should return available rooms without membership info when no userId', async () => {
      const expectedRooms = [
        createMockRoom({ id: 'room-1', name: 'Room One' }),
        createMockRoom({ id: 'room-2', name: 'Room Two' }),
      ]
      mockRoomRepository.findAvailable.mockResolvedValue(expectedRooms)

      const result = await useCase.execute()

      expect(result.rooms).toEqual(expectedRooms)
      expect(mockRoomRepository.findAvailable).toHaveBeenCalledWith(FIXED_NOW)
      expect(mockRoomMemberRepository.findByUserId).not.toHaveBeenCalled()
    })

    it('should return empty array when no rooms available', async () => {
      mockRoomRepository.findAvailable.mockResolvedValue([])

      const result = await useCase.execute()

      expect(result.rooms).toEqual([])
      expect(mockRoomRepository.findAvailable).toHaveBeenCalledOnce()
    })

    it('should enrich rooms with isMember flag when userId is provided', async () => {
      const rooms = [
        createMockRoom({ id: 'room-1', name: 'Room One' }),
        createMockRoom({ id: 'room-2', name: 'Room Two' }),
        createMockRoom({ id: 'room-3', name: 'Room Three' }),
      ]
      mockRoomRepository.findAvailable.mockResolvedValue(rooms)

      const memberships = [
        createMockRoomMember({ roomId: 'room-1', userId: 'user-1' }),
        createMockRoomMember({ roomId: 'room-3', userId: 'user-1' }),
      ]
      mockRoomMemberRepository.findByUserId.mockResolvedValue(memberships)

      const result = await useCase.execute({ userId: 'user-1' })

      expect(result.rooms).toHaveLength(3)
      expect(result.rooms[0]!.isMember).toBe(true)
      expect(result.rooms[1]!.isMember).toBe(false)
      expect(result.rooms[2]!.isMember).toBe(true)
      expect(mockRoomMemberRepository.findByUserId).toHaveBeenCalledWith('user-1')
    })
  })
})
