import { describe, it, expect, beforeEach } from 'vitest'
import { LeaveRoomUseCase } from './leave-room.use-case'
import { RoomNotFoundError, RoomReadyError } from '@application/errors'
import { createMockRoomMemberRepository } from '@test/mocks'

describe('LeaveRoomUseCase', () => {
  let useCase: LeaveRoomUseCase
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>

  beforeEach(() => {
    mockRoomMemberRepository = createMockRoomMemberRepository()
    useCase = new LeaveRoomUseCase(mockRoomMemberRepository)
  })

  describe('execute', () => {
    it('should leave room successfully and return member count', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({
        status: 'left',
        wasHost: false,
        memberCount: 3,
      })

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'regular-user',
      })

      expect(result.success).toBe(true)
      expect(result.wasHostLeave).toBe(false)
      expect(result.memberCount).toBe(3)
      expect(mockRoomMemberRepository.leaveOpenRoom).toHaveBeenCalledWith({
        roomId: 'room-1',
        userId: 'regular-user',
      })
    })

    it('should report a host leave so the controller can broadcast the deletion', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({
        status: 'left',
        wasHost: true,
        memberCount: 0,
      })

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'host-user',
      })

      expect(result.success).toBe(true)
      expect(result.wasHostLeave).toBe(true)
      expect(result.memberCount).toBe(0)
    })

    it('should return false if user not in room', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({ status: 'not_member' })

      const result = await useCase.execute({
        roomId: 'room-1',
        userId: 'non-member-user',
      })

      expect(result.success).toBe(false)
      expect(result.wasHostLeave).toBe(false)
      expect(result.memberCount).toBe(0)
    })

    it('should throw RoomReadyError if room is ready', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({ status: 'ready' })

      await expect(useCase.execute({ roomId: 'room-1', userId: 'any-user' })).rejects.toThrow(
        RoomReadyError
      )
    })

    it('should throw RoomNotFoundError if the room is gone', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({ status: 'not_found' })

      await expect(useCase.execute({ roomId: 'room-1', userId: 'any-user' })).rejects.toThrow(
        RoomNotFoundError
      )
    })
  })
})
