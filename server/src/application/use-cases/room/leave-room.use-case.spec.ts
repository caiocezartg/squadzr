import { describe, it, expect, beforeEach } from 'vitest'
import { LeaveRoomUseCase } from './leave-room.use-case'
import { NotRoomMemberError, RoomNotFoundError, RoomReadyError } from '@application/errors'
import {
  createMockClock,
  createMockRoom,
  createMockRoomMember,
  createMockRoomMemberRepository,
  createMockRoomRepository,
} from '@test/mocks'
import { ROOM } from '@config/constants'

const ACTIVITY = new Date('2026-01-01T00:00:00.000Z')
const READY_AT = new Date('2026-01-01T00:00:00.000Z')

describe('LeaveRoomUseCase', () => {
  let useCase: LeaveRoomUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    clock = createMockClock(ACTIVITY)
    useCase = new LeaveRoomUseCase(mockRoomRepository, mockRoomMemberRepository, clock)

    // An Open Room the caller belongs to, unless a test says otherwise.
    mockRoomRepository.findByCode.mockResolvedValue(
      createMockRoom({
        id: 'room-1',
        code: 'ABC123',
        hostId: 'host-user',
        lastActivityAt: ACTIVITY,
        createdAt: ACTIVITY,
      })
    )
    mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(
      createMockRoomMember({ roomId: 'room-1', userId: 'regular-user' })
    )
  })

  describe('execute', () => {
    it('should leave room successfully and return the Squad and remaining member count', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({
        status: 'left',
        wasHost: false,
        memberCount: 3,
      })

      const result = await useCase.execute({
        code: 'ABC123',
        userId: 'regular-user',
      })

      expect(result).toEqual({
        roomId: 'room-1',
        roomCode: 'ABC123',
        wasHostLeave: false,
        memberCount: 3,
      })
      expect(mockRoomRepository.findByCode).toHaveBeenCalledWith('ABC123')
      expect(mockRoomMemberRepository.leaveOpenRoom).toHaveBeenCalledWith({
        roomId: 'room-1',
        userId: 'regular-user',
      })
    })

    it('should report a host leave so the handler can broadcast the deletion', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({
        status: 'left',
        wasHost: true,
        memberCount: 0,
      })

      const result = await useCase.execute({
        code: 'ABC123',
        userId: 'host-user',
      })

      expect(result).toEqual({
        roomId: 'room-1',
        roomCode: 'ABC123',
        wasHostLeave: true,
        memberCount: 0,
      })
    })

    it('should throw NotRoomMemberError if user is not in an Open room', async () => {
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({ status: 'not_member' })

      const outcome = useCase.execute({
        code: 'ABC123',
        userId: 'non-member-user',
      })

      await expect(outcome).rejects.toBeInstanceOf(NotRoomMemberError)
      await expect(outcome).rejects.toMatchObject({
        code: 'NOT_ROOM_MEMBER',
        statusCode: 422,
        message: 'User "non-member-user" is not a member of room "room-1"',
      })
    })

    it('should throw RoomReadyError if room is ready', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(
        createMockRoom({
          id: 'room-1',
          code: 'ABC123',
          lastActivityAt: READY_AT,
          createdAt: READY_AT,
          readyAt: READY_AT,
        })
      )
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({ status: 'ready' })

      await expect(useCase.execute({ code: 'ABC123', userId: 'regular-user' })).rejects.toThrow(
        RoomReadyError
      )
    })

    it('should throw RoomNotFoundError if the room is gone when the lock is taken', async () => {
      mockRoomMemberRepository.leaveOpenRoom.mockResolvedValue({ status: 'not_found' })

      await expect(useCase.execute({ code: 'ABC123', userId: 'regular-user' })).rejects.toThrow(
        RoomNotFoundError
      )
    })

    it('should throw RoomNotFoundError for a missing Squad without touching memberships', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(null)

      const outcome = useCase.execute({ code: 'MISSNG', userId: 'regular-user' })

      await expect(outcome).rejects.toBeInstanceOf(RoomNotFoundError)
      await expect(outcome).rejects.toMatchObject({
        code: 'ROOM_NOT_FOUND',
        message: 'Room "MISSNG" not found',
      })
      expect(mockRoomMemberRepository.leaveOpenRoom).not.toHaveBeenCalled()
    })

    it('should throw RoomNotFoundError to a non-member of a Ready Room, without leaving it', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(
        createMockRoom({
          id: 'room-1',
          code: 'ABC123',
          lastActivityAt: READY_AT,
          createdAt: READY_AT,
          readyAt: READY_AT,
        })
      )
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)

      const outcome = useCase.execute({ code: 'ABC123', userId: 'outsider-user' })

      await expect(outcome).rejects.toBeInstanceOf(RoomNotFoundError)
      await expect(outcome).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' })
      expect(mockRoomMemberRepository.leaveOpenRoom).not.toHaveBeenCalled()
    })

    it('should throw RoomNotFoundError for an expired Open room, without leaving it', async () => {
      clock.set(new Date(ACTIVITY.getTime() + ROOM.OPEN_ROOM_TTL_MS))

      const outcome = useCase.execute({ code: 'ABC123', userId: 'regular-user' })

      await expect(outcome).rejects.toBeInstanceOf(RoomNotFoundError)
      await expect(outcome).rejects.toMatchObject({ code: 'ROOM_NOT_FOUND' })
      expect(mockRoomMemberRepository.leaveOpenRoom).not.toHaveBeenCalled()
    })
  })
})
