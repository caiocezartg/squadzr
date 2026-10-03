import { describe, it, expect, beforeEach } from 'vitest'
import { JoinRoomUseCase } from './join-room.use-case'
import { RoomNotFoundError, RoomFullError, RoomJoinLimitReachedError } from '@application/errors'
import {
  createMockRoom,
  createMockRoomRepository,
  createMockRoomMember,
  createMockRoomMemberRepository,
} from '@test/mocks'

describe('JoinRoomUseCase', () => {
  let useCase: JoinRoomUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    useCase = new JoinRoomUseCase(mockRoomRepository, mockRoomMemberRepository)
  })

  describe('execute', () => {
    it('should join room successfully', async () => {
      const room = createMockRoom({ id: 'room-1', maxPlayers: 5 })
      const expectedMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-1' })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.createIfCapacityAvailable.mockResolvedValue({
        member: expectedMember,
        memberCount: 3,
      })

      const result = await useCase.execute({ roomId: 'room-1', userId: 'user-1' })

      expect(result.roomMember).toEqual(expectedMember)
      expect(result.memberCount).toBe(3)
      expect(result.isRoomNowFull).toBe(false)
      expect(mockRoomRepository.findById).toHaveBeenCalledWith('room-1')
      expect(mockRoomMemberRepository.findByRoomAndUser).toHaveBeenCalledWith('room-1', 'user-1')
      expect(mockRoomMemberRepository.createIfCapacityAvailable).toHaveBeenCalledWith(
        { roomId: 'room-1', userId: 'user-1' },
        5
      )
    })

    it('should throw RoomNotFoundError if room not found', async () => {
      mockRoomRepository.findById.mockResolvedValue(null)

      await expect(
        useCase.execute({ roomId: 'non-existent-room', userId: 'user-1' })
      ).rejects.toThrow(RoomNotFoundError)

      expect(mockRoomRepository.findById).toHaveBeenCalledWith('non-existent-room')
      expect(mockRoomMemberRepository.createIfCapacityAvailable).not.toHaveBeenCalled()
    })

    it('should throw RoomFullError if room is full', async () => {
      const room = createMockRoom({ id: 'room-1', maxPlayers: 5 })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.createIfCapacityAvailable.mockResolvedValue({
        member: null,
        memberCount: 5,
      })

      await expect(useCase.execute({ roomId: 'room-1', userId: 'user-1' })).rejects.toThrow(
        RoomFullError
      )

      expect(mockRoomMemberRepository.createIfCapacityAvailable).toHaveBeenCalledWith(
        { roomId: 'room-1', userId: 'user-1' },
        5
      )
    })

    it('should return existing member if user already in room (idempotent)', async () => {
      const room = createMockRoom({ id: 'room-1', maxPlayers: 5 })
      const existingMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-1' })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(existingMember)
      mockRoomMemberRepository.countByRoomId.mockResolvedValue(3)

      const result = await useCase.execute({ roomId: 'room-1', userId: 'user-1' })

      expect(result.roomMember).toEqual(existingMember)
      expect(result.memberCount).toBe(3)
      expect(result.isRoomNowFull).toBe(false)
      expect(mockRoomMemberRepository.createIfCapacityAvailable).not.toHaveBeenCalled()
    })

    it('should set readyAt when last player joins', async () => {
      const room = createMockRoom({ id: 'room-1', maxPlayers: 3 })
      const expectedMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-3' })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.createIfCapacityAvailable.mockResolvedValue({
        member: expectedMember,
        memberCount: 3,
      })
      mockRoomRepository.update.mockResolvedValue(createMockRoom({ ...room, readyAt: new Date() }))

      const result = await useCase.execute({ roomId: 'room-1', userId: 'user-3' })

      expect(result.roomMember).toEqual(expectedMember)
      expect(result.memberCount).toBe(3)
      expect(result.isRoomNowFull).toBe(true)
      expect(mockRoomRepository.update).toHaveBeenCalledWith('room-1', {
        readyAt: expect.any(Date),
      })
    })

    it('should not set readyAt when room is not full after join', async () => {
      const room = createMockRoom({ id: 'room-1', maxPlayers: 5 })
      const expectedMember = createMockRoomMember({ roomId: 'room-1', userId: 'user-2' })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.createIfCapacityAvailable.mockResolvedValue({
        member: expectedMember,
        memberCount: 2,
      })

      const result = await useCase.execute({ roomId: 'room-1', userId: 'user-2' })

      expect(result.isRoomNowFull).toBe(false)
      expect(mockRoomRepository.update).not.toHaveBeenCalled()
    })

    it('should throw RoomJoinLimitReachedError when user is already in 5 active rooms', async () => {
      const room = createMockRoom({ id: 'room-id', maxPlayers: 5 })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.countActiveByUserId.mockResolvedValue(5)

      await expect(useCase.execute({ roomId: 'room-id', userId: 'user-id' })).rejects.toThrow(
        RoomJoinLimitReachedError
      )

      expect(mockRoomMemberRepository.createIfCapacityAvailable).not.toHaveBeenCalled()
    })

    it('should allow joining when user is in 4 active rooms (below limit)', async () => {
      const room = createMockRoom({ id: 'room-id', maxPlayers: 5 })
      const expectedMember = createMockRoomMember({ roomId: 'room-id', userId: 'user-id' })

      mockRoomRepository.findById.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      mockRoomMemberRepository.countActiveByUserId.mockResolvedValue(4)
      mockRoomMemberRepository.createIfCapacityAvailable.mockResolvedValue({
        member: expectedMember,
        memberCount: 3,
      })

      const result = await useCase.execute({ roomId: 'room-id', userId: 'user-id' })

      expect(mockRoomMemberRepository.createIfCapacityAvailable).toHaveBeenCalledOnce()
      expect(result.roomMember).toBeDefined()
    })
  })
})
