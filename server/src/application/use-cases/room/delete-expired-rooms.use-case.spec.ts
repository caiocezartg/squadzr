import { describe, it, expect, beforeEach } from 'vitest'
import { DeleteExpiredRoomsUseCase } from './delete-expired-rooms.use-case'
import { createMockClock, createMockRoom, createMockRoomRepository, FIXED_NOW } from '@test/mocks'

describe('DeleteExpiredRoomsUseCase', () => {
  let useCase: DeleteExpiredRoomsUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    clock = createMockClock()
    useCase = new DeleteExpiredRoomsUseCase(mockRoomRepository, clock)
  })

  describe('execute', () => {
    it('should delete expired rooms and report the reason', async () => {
      const expiredRooms = [
        createMockRoom({ id: 'room-1', code: 'ABC123', readyAt: FIXED_NOW }),
        createMockRoom({ id: 'room-2', code: 'DEF456', readyAt: null }),
      ]

      mockRoomRepository.findExpiredRooms.mockResolvedValue(expiredRooms)
      mockRoomRepository.deleteExpired.mockResolvedValue(true)

      const result = await useCase.execute()

      expect(result.deletedRooms).toEqual([
        { id: 'room-1', code: 'ABC123', reason: 'ready_expired' },
        { id: 'room-2', code: 'DEF456', reason: 'open_expired' },
      ])
      expect(mockRoomRepository.findExpiredRooms).toHaveBeenCalledWith(FIXED_NOW)
      expect(mockRoomRepository.deleteExpired).toHaveBeenCalledTimes(2)
      expect(mockRoomRepository.deleteExpired).toHaveBeenCalledWith('room-1', FIXED_NOW)
      expect(mockRoomRepository.deleteExpired).toHaveBeenCalledWith('room-2', FIXED_NOW)
    })

    it('should return empty array when no expired rooms exist', async () => {
      mockRoomRepository.findExpiredRooms.mockResolvedValue([])

      const result = await useCase.execute()

      expect(result.deletedRooms).toEqual([])
      expect(mockRoomRepository.deleteExpired).not.toHaveBeenCalled()
    })

    it('should skip rooms that a concurrent activity change kept alive', async () => {
      const expiredRooms = [
        createMockRoom({ id: 'room-1', code: 'ABC123' }),
        createMockRoom({ id: 'room-2', code: 'DEF456' }),
      ]

      mockRoomRepository.findExpiredRooms.mockResolvedValue(expiredRooms)
      mockRoomRepository.deleteExpired.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const result = await useCase.execute()

      expect(result.deletedRooms).toEqual([
        { id: 'room-1', code: 'ABC123', reason: 'open_expired' },
      ])
    })
  })
})
