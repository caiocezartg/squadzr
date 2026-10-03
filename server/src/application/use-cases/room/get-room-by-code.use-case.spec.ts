import { describe, it, expect, beforeEach } from 'vitest'
import { GetRoomByCodeUseCase } from './get-room-by-code.use-case'
import {
  createMockRoom,
  createMockRoomMember,
  createMockRoomRepository,
  createMockRoomMemberRepository,
  createMockUser,
  createMockUserRepository,
} from '@test/mocks'

describe('GetRoomByCodeUseCase', () => {
  let useCase: GetRoomByCodeUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockRoomMemberRepository: ReturnType<typeof createMockRoomMemberRepository>
  let mockUserRepository: ReturnType<typeof createMockUserRepository>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockRoomMemberRepository = createMockRoomMemberRepository()
    mockUserRepository = createMockUserRepository()
    useCase = new GetRoomByCodeUseCase(
      mockRoomRepository,
      mockRoomMemberRepository,
      mockUserRepository
    )
  })

  describe('execute', () => {
    it('should return room and players when found', async () => {
      const expectedRoom = createMockRoom({ code: 'ABC123' })
      mockRoomRepository.findByCode.mockResolvedValue(expectedRoom)
      mockRoomMemberRepository.findByRoomId.mockResolvedValue([])
      mockUserRepository.findByIds.mockResolvedValue([])

      const result = await useCase.execute({ code: 'ABC123' })

      expect(result.room).toEqual(expectedRoom)
      expect(result.players).toEqual([])
      expect(mockRoomRepository.findByCode).toHaveBeenCalledWith('ABC123')
      expect(mockRoomRepository.findByCode).toHaveBeenCalledOnce()
    })

    it('should return null and empty players when not found', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(null)

      const result = await useCase.execute({ code: 'NOTFND' })

      expect(result.room).toBeNull()
      expect(result.players).toEqual([])
      expect(mockRoomRepository.findByCode).toHaveBeenCalledWith('NOTFND')
    })

    it('should resolve the roster only for a viewer who is a member of the room', async () => {
      const room = createMockRoom({ id: 'room-1', hostId: 'host-1' })
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
      mockRoomRepository.findByCode.mockResolvedValue(createMockRoom({ id: 'room-1' }))
      mockRoomMemberRepository.findByRoomAndUser.mockResolvedValue(null)

      const result = await useCase.execute({ code: 'ABC123', viewerId: 'outsider-1' })

      expect(result.isMember).toBe(false)
      expect(result.players).toEqual([])
      expect(mockRoomMemberRepository.findByRoomId).not.toHaveBeenCalled()
      expect(mockUserRepository.findByIds).not.toHaveBeenCalled()
    })

    it('should treat an anonymous viewer as a non-member without querying memberships', async () => {
      mockRoomRepository.findByCode.mockResolvedValue(createMockRoom())

      const result = await useCase.execute({ code: 'ABC123' })

      expect(result.isMember).toBe(false)
      expect(mockRoomMemberRepository.findByRoomAndUser).not.toHaveBeenCalled()
      expect(mockRoomMemberRepository.findByRoomId).not.toHaveBeenCalled()
    })
  })
})
