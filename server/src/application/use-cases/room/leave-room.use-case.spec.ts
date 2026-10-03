import { describe, it, expect, beforeEach } from 'vitest'
import { LeaveRoomUseCase } from './leave-room.use-case'
import {
  createMockRoom,
  createMockRoomRepository,
  createMockRoomMemberRepository,
} from '@test/mocks'

describe('LeaveRoomUseCase', () => {
  let useCase: LeaveRoomUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    useCase = new LeaveRoomUseCase(mockRoomRepository, mockRoomMemberRepository)
  })

  describe('execute', () => {
    it('should leave room successfully and return member count', async () => {
      const room = createMockRoom({ id: 'room-1', hostId: 'host-user' })

      mockRoomMemberRepository.delete.mockResolvedValue(true)
      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.countByRoomId.mockResolvedValue(3)

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'regular-user',
      })

      expect(result.success).toBe(true)
      expect(result.wasHostLeave).toBe(false)
      expect(result.memberCount).toBe(3)
      expect(mockRoomMemberRepository.delete).toHaveBeenCalledWith('room-1', 'regular-user')
      expect(mockRoomMemberRepository.countByRoomId).toHaveBeenCalledWith('room-1')
      expect(mockRoomRepository.delete).not.toHaveBeenCalled()
    })

    it('should delete room if host leaves', async () => {
      const room = createMockRoom({ id: 'room-1', hostId: 'host-user' })

      mockRoomMemberRepository.delete.mockResolvedValue(true)
      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.deleteByRoomId.mockResolvedValue(true)
      mockRoomRepository.delete.mockResolvedValue(true)

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'host-user',
      })

      expect(result.success).toBe(true)
      expect(result.wasHostLeave).toBe(true)
      expect(result.memberCount).toBe(0)
      expect(mockRoomMemberRepository.delete).toHaveBeenCalledWith('room-1', 'host-user')
      expect(mockRoomMemberRepository.deleteByRoomId).toHaveBeenCalledWith('room-1')
      expect(mockRoomRepository.delete).toHaveBeenCalledWith('room-1')
    })

    it('should return false if user not in room', async () => {
      const room = createMockRoom({ id: 'room-1' })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.delete.mockResolvedValue(false)

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'non-member-user',
      })

      expect(result.success).toBe(false)
      expect(result.wasHostLeave).toBe(false)
      expect(mockRoomMemberRepository.delete).toHaveBeenCalledWith('room-1', 'non-member-user')
      expect(mockRoomRepository.delete).not.toHaveBeenCalled()
    })

    it('should throw RoomReadyError if room is ready', async () => {
      const room = createMockRoom({ id: 'room-1', readyAt: new Date() })

      mockRoomRepository.findById.mockResolvedValue(room)

      await expect(useCase.execute({ roomId: 'room-1', userId: 'any-user' })).rejects.toThrow(
        'ready'
      )
    })
  })
})
