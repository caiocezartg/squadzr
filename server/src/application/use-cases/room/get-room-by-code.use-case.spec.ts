import { describe, it, expect, beforeEach } from 'vitest'
import { GetRoomByCodeUseCase } from './get-room-by-code.use-case'
import {
  createMockClock,
  createMockRoom,
  createMockRoomMember,
  createMockRoomRepository,
  createMockRoomMemberRepository,
  createMockUser,
  createMockUserRepository,
} from '@test/mocks'
import { ROOM } from '@config/constants'

const ACTIVITY = new Date('2026-01-01T00:00:00.000Z')
const READY_AT = new Date('2026-01-01T00:00:00.000Z')

describe('GetRoomByCodeUseCase', () => {
  let useCase: GetRoomByCodeUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>
  let mockUserRepository: ReturnType<typeof createMockUserRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    mockUserRepository = createMockUserRepository()
    clock = createMockClock(ACTIVITY)
    useCase = new GetRoomByCodeUseCase(
      mockRoomRepository,
      mockRoomMemberRepository,
      mockUserRepository,
      clock
    )
  })

  describe('execute', () => {
    it('should return room and players when found', async () => {
      const expectedRoom = createMockRoom({
        code: 'ABC123',
        lastActivityAt: ACTIVITY,
        createdAt: ACTIVITY,
      })
      mockRoomRepository.findByCode.mockResolvedValue(expectedRoom)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(
        createMockRoomMember({ roomId: expectedRoom.id, userId: 'member-1' })
      )
      mockRoomMemberRepository.findByRoomId.mockResolvedValue([])
      mockUserRepository.findByIds.mockResolvedValue([])

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

      expect(result.room).toEqual(expectedRoom)
      expect(result.isMember).toBe(true)
      expect(result.players).toEqual([])
      expect(mockRoomRepository.findByCode).toHaveBeenCalledWith('ABC123')
    })

    it('should return null and empty players when not found', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(null)

      const result = await useCase.execute({ code: 'NOTFND' })

      expect(result.room).toBeNull()
      expect(result.players).toEqual([])
      expect(mockRoomRepository.findByCode).toHaveBeenCalledWith('NOTFND')
    })

    it('should resolve the roster only for a viewer who is a member of the room', async () => {
      const room = createMockRoom({
        id: 'room-1',
        hostId: 'host-1',
        lastActivityAt: ACTIVITY,
        createdAt: ACTIVITY,
      })
      const members = [
        createMockRoomMember({ roomId: 'room-1', userId: 'host-1' }),
        createMockRoomMember({ roomId: 'room-1', userId: 'member-1' }),
      ]
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(members[1]!)
      mockRoomMemberRepository.findByRoomId.mockResolvedValue(members)
      mockUserRepository.findByIds.mockResolvedValue([
        createMockUser({ id: 'host-1', name: 'Host' }),
        createMockUser({ id: 'member-1', name: 'Member', avatarUrl: 'https://cdn.test/m.png' }),
      ])

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

      expect(result.isMember).toBe(true)
      expect(result.players).toEqual([
        { id: 'host-1', name: 'Host', image: null, isHost: true },
        { id: 'member-1', name: 'Member', image: 'https://cdn.test/m.png', isHost: false },
      ])
      expect(mockRoomMemberRepository.findByRoomAndUser).toHaveBeenCalledWith('room-1', 'member-1')
    })

    it('should not resolve the roster for a viewer without membership', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(
        createMockRoom({ id: 'room-1', lastActivityAt: ACTIVITY, createdAt: ACTIVITY })
      )
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'outsider-1' })

      expect(result.isMember).toBe(false)
      expect(result.players).toEqual([])
      expect(mockRoomMemberRepository.findByRoomId).not.toHaveBeenCalled()
      expect(mockUserRepository.findByIds).not.toHaveBeenCalled()
    })

    it('should treat an anonymous viewer as a non-member without querying memberships', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(
        createMockRoom({ lastActivityAt: ACTIVITY, createdAt: ACTIVITY })
      )

      const result = await useCase.execute({ code: 'ABC123' })

      expect(result.isMember).toBe(false)
      expect(mockRoomMemberRepository.findByRoomAndUser).not.toHaveBeenCalled()
      expect(mockRoomMemberRepository.findByRoomId).not.toHaveBeenCalled()
    })

    it('should hide an Open Room at exactly lastActivityAt + 24h', async () => {
      const room = createMockRoom({ lastActivityAt: ACTIVITY, createdAt: ACTIVITY })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(
        createMockRoomMember({ roomId: room.id, userId: 'member-1' })
      )
      clock.set(new Date(ACTIVITY.getTime() + ROOM.OPEN_ROOM_TTL_MS))

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

      expect(result.room).toBeNull()
      expect(result.isMember).toBe(false)
      expect(result.players).toEqual([])
    })

    it('should serve an Open Room one millisecond before its expiration', async () => {
      const room = createMockRoom({ lastActivityAt: ACTIVITY, createdAt: ACTIVITY })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(
        createMockRoomMember({ roomId: room.id, userId: 'member-1' })
      )
      mockRoomMemberRepository.findByRoomId.mockResolvedValue([])
      mockUserRepository.findByIds.mockResolvedValue([])
      clock.set(new Date(ACTIVITY.getTime() + ROOM.OPEN_ROOM_TTL_MS - 1))

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

      expect(result.room).toEqual(room)
      expect(result.isMember).toBe(true)
    })

    it('should answer 404 to a non-member of a Ready Room during retention', async () => {
      const room = createMockRoom({
        lastActivityAt: READY_AT,
        createdAt: READY_AT,
        readyAt: READY_AT,
      })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)
      clock.set(new Date(READY_AT.getTime() + 1_000))

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'outsider-1' })

      expect(result.room).toBeNull()
      expect(result.isMember).toBe(false)
    })

    it('should serve a Ready Room to its member inside retention', async () => {
      const room = createMockRoom({
        lastActivityAt: READY_AT,
        createdAt: READY_AT,
        readyAt: READY_AT,
      })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(
        createMockRoomMember({ roomId: room.id, userId: 'member-1' })
      )
      mockRoomMemberRepository.findByRoomId.mockResolvedValue([])
      mockUserRepository.findByIds.mockResolvedValue([])
      clock.set(new Date(READY_AT.getTime() + ROOM.READY_ROOM_RETENTION_MS - 1))

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

      expect(result.room).toEqual(room)
      expect(result.isMember).toBe(true)
    })

    it('should hide a Ready Room at exactly readyAt + 60min, even for its member', async () => {
      const room = createMockRoom({
        lastActivityAt: READY_AT,
        createdAt: READY_AT,
        readyAt: READY_AT,
      })
      mockRoomRepository.findByCode.mockResolvedValue(room)
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(
        createMockRoomMember({ roomId: room.id, userId: 'member-1' })
      )
      clock.set(new Date(READY_AT.getTime() + ROOM.READY_ROOM_RETENTION_MS))

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'member-1' })

      expect(result.room).toBeNull()
      expect(result.isMember).toBe(false)
    })
  })
})
