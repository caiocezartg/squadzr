import { describe, it, expect, beforeEach } from 'vitest'
import { DeleteExpiredRoomsUseCase } from './delete-expired-rooms.use-case'
import { createMockRoom, createMockRoomRepository } from '@test/mocks'

describe('DeleteExpiredRoomsUseCase', () => {
  let useCase: DeleteExpiredRoomsUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    useCase = new DeleteExpiredRoomsUseCase(mockRoomRepository)
  })

  describe('execute', () => {
    it('should delete expired rooms and return their ids and codes', async () => {
      const expiredRooms = [
        createMockRoom({ id: 'room-1', code: 'ABC123' }),
        createMockRoom({ id: 'room-2', code: 'DEF456' }),
      ]

      mockRoomRepository.findExpiredRooms.mockResolvedValue(expiredRooms)
      mockRoomRepository.delete.mockResolvedValue(true)

      const result = await useCase.execute({ expirationMinutes: 5 })

      expect(result.deletedRooms).toEqual([
        { id: 'room-1', code: 'ABC123' },
        { id: 'room-2', code: 'DEF456' },
      ])
      expect(mockRoomRepository.findExpiredRooms).toHaveBeenCalledWith(expect.any(Date))
      expect(mockRoomRepository.delete).toHaveBeenCalledTimes(2)
      expect(mockRoomRepository.delete).toHaveBeenCalledWith('room-1')
      expect(mockRoomRepository.delete).toHaveBeenCalledWith('room-2')
    })

    it('should return empty array when no expired rooms exist', async () => {
      mockRoomRepository.findExpiredRooms.mockResolvedValue([])

      const result = await useCase.execute({ expirationMinutes: 5 })

      expect(result.deletedRooms).toEqual([])
      expect(mockRoomRepository.delete).not.toHaveBeenCalled()
    })

    it('should skip rooms that fail to delete', async () => {
      const expiredRooms = [
        createMockRoom({ id: 'room-1', code: 'ABC123' }),
        createMockRoom({ id: 'room-2', code: 'DEF456' }),
      ]

      mockRoomRepository.findExpiredRooms.mockResolvedValue(expiredRooms)
      mockRoomRepository.delete.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

      const result = await useCase.execute({ expirationMinutes: 5 })

      expect(result.deletedRooms).toEqual([{ id: 'room-1', code: 'ABC123' }])
    })

    it('should calculate cutoff date correctly', async () => {
      mockRoomRepository.findExpiredRooms.mockResolvedValue([])

      const before = Date.now()
      await useCase.execute({ expirationMinutes: 5 })
      const after = Date.now()

      const calledWith = mockRoomRepository.findExpiredRooms.mock.calls[0]![0] as Date
      const expectedMin = before - 5 * 60_000
      const expectedMax = after - 5 * 60_000

      expect(calledWith.getTime()).toBeGreaterThanOrEqual(expectedMin)
      expect(calledWith.getTime()).toBeLessThanOrEqual(expectedMax)
    })
  })
})
