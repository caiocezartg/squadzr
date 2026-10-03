import { describe, it, expect, beforeEach } from 'vitest'
import { CreateRoomUseCase } from './create-room.use-case'
import { InvalidGameError, RoomCreateLimitReachedError } from '@application/errors'
import {
  createMockClock,
  createMockRoom,
  createMockRoomRepository,
  createMockRoomMember,
  createMockGameRepository,
  createMockGame,
  FIXED_NOW,
} from '@test/mocks'

describe('CreateRoomUseCase', () => {
  let useCase: CreateRoomUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockGameRepository: ReturnType<typeof createMockGameRepository>
  let clock: ReturnType<typeof createMockClock>

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockGameRepository = createMockGameRepository()
    clock = createMockClock()
    useCase = new CreateRoomUseCase(mockRoomRepository, mockGameRepository, clock)
  })

  describe('execute', () => {
    it('should create room successfully with all fields', async () => {
      const game = createMockGame({ id: 'game-123', maxPlayers: 5 })
      mockGameRepository.findById.mockResolvedValue(game)

      const expectedRoom = createMockRoom({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 5,
      })
      mockRoomRepository.create.mockResolvedValue({
        room: expectedRoom,
        hostMember: createMockRoomMember({ roomId: expectedRoom.id, userId: 'host-123' }),
      })

      const result = await useCase.execute({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 5,
        discordLink: 'https://discord.gg/test',
      })

      expect(result.room.name).toBe('My Room')
      expect(result.room.hostId).toBe('host-123')
      expect(result.room.gameId).toBe('game-123')
      expect(result.room.maxPlayers).toBe(5)
      expect(mockRoomRepository.create).toHaveBeenCalledWith(
        {
          name: 'My Room',
          hostId: 'host-123',
          gameId: 'game-123',
          maxPlayers: 5,
          discordLink: 'https://discord.gg/test',
        },
        FIXED_NOW
      )
      expect(mockRoomRepository.create).toHaveBeenCalledOnce()
    })

    it('should return the host membership created in the same transaction', async () => {
      const game = createMockGame({ id: 'game-123' })
      mockGameRepository.findById.mockResolvedValue(game)

      const expectedRoom = createMockRoom({ id: 'room-1', hostId: 'host-123' })
      const expectedMember = createMockRoomMember({
        roomId: 'room-1',
        userId: 'host-123',
      })
      mockRoomRepository.create.mockResolvedValue({
        room: expectedRoom,
        hostMember: expectedMember,
      })

      const result = await useCase.execute({
        name: 'Test Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      })

      expect(result.hostMember).toEqual(expectedMember)
      expect(result.hostMember.roomId).toBe('room-1')
      expect(result.hostMember.userId).toBe('host-123')
    })

    it('should return room with valid 6-char alphanumeric code from repository', async () => {
      const game = createMockGame({ id: 'game-123' })
      mockGameRepository.findById.mockResolvedValue(game)

      const expectedRoom = createMockRoom({ code: 'ABC123' })
      mockRoomRepository.create.mockResolvedValue({
        room: expectedRoom,
        hostMember: createMockRoomMember(),
      })

      const result = await useCase.execute({
        name: 'Test Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      })

      expect(result.room.code).toMatch(/^[A-Z0-9]{6}$/)
    })

    it('should use game maxPlayers as default when not provided', async () => {
      const game = createMockGame({ id: 'game-123', maxPlayers: 10 })
      mockGameRepository.findById.mockResolvedValue(game)

      mockRoomRepository.create.mockResolvedValue({
        room: createMockRoom({ maxPlayers: 10 }),
        hostMember: createMockRoomMember(),
      })

      await useCase.execute({
        name: 'Test Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      })

      expect(mockRoomRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          maxPlayers: 10,
        }),
        FIXED_NOW
      )
    })

    it('should pass custom maxPlayers to repository', async () => {
      const game = createMockGame({ id: 'game-123', maxPlayers: 5 })
      mockGameRepository.findById.mockResolvedValue(game)

      mockRoomRepository.create.mockResolvedValue({
        room: createMockRoom({ maxPlayers: 10 }),
        hostMember: createMockRoomMember(),
      })

      await useCase.execute({
        name: 'Test Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 10,
        discordLink: 'https://discord.gg/test',
      })

      expect(mockRoomRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          maxPlayers: 10,
          discordLink: 'https://discord.gg/test',
        }),
        FIXED_NOW
      )
    })

    it('should throw InvalidGameError if game does not exist', async () => {
      mockGameRepository.findById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          name: 'Test Room',
          hostId: 'host-123',
          gameId: 'non-existent-game',
          discordLink: 'https://discord.gg/test',
        })
      ).rejects.toThrow(InvalidGameError)

      expect(mockRoomRepository.create).not.toHaveBeenCalled()
    })

    it('should throw RoomCreateLimitReachedError when user already hosts 3 valid rooms', async () => {
      const game = createMockGame({ id: 'game-123' })
      mockGameRepository.findById.mockResolvedValue(game)
      mockRoomRepository.countActiveByHostId.mockResolvedValue(3)

      await expect(
        useCase.execute({
          name: 'Test Room',
          hostId: 'host-123',
          gameId: 'game-123',
          discordLink: 'https://discord.gg/test',
        })
      ).rejects.toThrow(RoomCreateLimitReachedError)

      expect(mockRoomRepository.countActiveByHostId).toHaveBeenCalledWith('host-123', FIXED_NOW)
      expect(mockRoomRepository.create).not.toHaveBeenCalled()
    })

    it('should allow room creation when user hosts 2 valid rooms (below limit)', async () => {
      const game = createMockGame({ id: 'game-123', maxPlayers: 5 })
      mockGameRepository.findById.mockResolvedValue(game)
      mockRoomRepository.countActiveByHostId.mockResolvedValue(2)

      const expectedRoom = createMockRoom({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 5,
      })
      mockRoomRepository.create.mockResolvedValue({
        room: expectedRoom,
        hostMember: createMockRoomMember({ roomId: expectedRoom.id, userId: 'host-123' }),
      })

      const result = await useCase.execute({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 5,
        discordLink: 'https://discord.gg/test',
      })

      expect(mockRoomRepository.create).toHaveBeenCalledOnce()
      expect(result.room).toBeDefined()
    })
  })
})
