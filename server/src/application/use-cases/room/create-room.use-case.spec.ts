import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateRoomUseCase } from './create-room.use-case'
import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import {
  GameNotAvailableError,
  InvalidDiscordInviteError,
  InvalidGameError,
  RoomCreateLimitReachedError,
  UserNotFoundError,
} from '@application/errors'
import {
  createMockRoom,
  createMockRoomRepository,
  createMockRoomMember,
  createMockGameRepository,
  createMockGame,
  createMockUser,
  createMockUserRepository,
} from '@test/mocks'

describe('CreateRoomUseCase', () => {
  let useCase: CreateRoomUseCase
  let mockRoomRepository: ReturnType<typeof createMockRoomRepository>
  let mockGameRepository: ReturnType<typeof createMockGameRepository>
  let mockUserRepository: ReturnType<typeof createMockUserRepository>
  let mockDiscordPreviews: {
    fetch: ReturnType<typeof vi.fn<DiscordInvitePreviewProvider['fetch']>>
  }

  beforeEach(() => {
    mockRoomRepository = createMockRoomRepository()
    mockGameRepository = createMockGameRepository()
    mockUserRepository = createMockUserRepository()
    mockUserRepository.findById.mockImplementation((id) =>
      Promise.resolve(createMockUser({ id, name: 'Host', avatarUrl: null }))
    )
    mockDiscordPreviews = {
      fetch: vi.fn<DiscordInvitePreviewProvider['fetch']>().mockResolvedValue({
        kind: 'found',
        preview: {
          name: 'Test Server',
          iconUrl: null,
          backdropUrl: null,
          memberCount: 10,
          onlineCount: 5,
          expiresAt: null,
        },
      }),
    }
    useCase = new CreateRoomUseCase(
      mockRoomRepository,
      mockGameRepository,
      mockUserRepository,
      mockDiscordPreviews
    )
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
        status: 'created',
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
      expect(mockRoomRepository.create).toHaveBeenCalledWith({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 5,
        discordLink: 'https://discord.gg/test',
      })
      expect(mockRoomRepository.create).toHaveBeenCalledOnce()
    })

    it('reuses the Game it read to validate the input as the created Squad summary', async () => {
      const game = createMockGame({ id: 'game-123', name: 'League of Legends' })
      mockGameRepository.findById.mockResolvedValue(game)
      mockRoomRepository.create.mockResolvedValue({
        status: 'created',
        room: createMockRoom({ gameId: 'game-123' }),
        hostMember: createMockRoomMember(),
      })

      const result = await useCase.execute({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      })

      expect(result.room.game).toBe(game)
      expect(mockGameRepository.findById).toHaveBeenCalledOnce()
      expect(mockGameRepository.findById).toHaveBeenCalledWith('game-123')
    })

    it("carries the host's entry as the whole member preview", async () => {
      mockGameRepository.findById.mockResolvedValue(createMockGame({ id: 'game-123' }))
      mockUserRepository.findById.mockResolvedValue(
        createMockUser({
          id: 'host-123',
          name: 'Host Name',
          avatarUrl: 'https://cdn.discordapp.com/avatars/host.png',
        })
      )

      const result = await useCase.execute({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      })

      expect(mockUserRepository.findById).toHaveBeenCalledWith('host-123')
      expect(result.room.memberPreview).toEqual([
        {
          id: 'host-123',
          name: 'Host Name',
          image: 'https://cdn.discordapp.com/avatars/host.png',
        },
      ])
    })

    it('throws UserNotFoundError without creating the Squad when the host cannot be read', async () => {
      mockGameRepository.findById.mockResolvedValue(createMockGame({ id: 'game-123' }))
      mockUserRepository.findById.mockResolvedValue(null)

      await expect(
        useCase.execute({
          name: 'My Room',
          hostId: 'host-123',
          gameId: 'game-123',
          discordLink: 'https://discord.gg/test',
        })
      ).rejects.toThrow(UserNotFoundError)
      expect(mockRoomRepository.create).not.toHaveBeenCalled()
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
        status: 'created',
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
        status: 'created',
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
        status: 'created',
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
        })
      )
    })

    it('should pass custom maxPlayers to repository', async () => {
      const game = createMockGame({ id: 'game-123', maxPlayers: 5 })
      mockGameRepository.findById.mockResolvedValue(game)

      mockRoomRepository.create.mockResolvedValue({
        status: 'created',
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
        })
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

    it('should throw GameNotAvailableError if the game is delisted', async () => {
      const delisted = createMockGame({ id: 'game-123', listed: false })
      mockGameRepository.findById.mockResolvedValue(delisted)

      await expect(
        useCase.execute({
          name: 'Test Room',
          hostId: 'host-123',
          gameId: 'game-123',
          discordLink: 'https://discord.gg/test',
        })
      ).rejects.toThrow(GameNotAvailableError)

      expect(mockRoomRepository.create).not.toHaveBeenCalled()
    })

    it('should throw RoomCreateLimitReachedError when the transaction reports the host limit', async () => {
      const game = createMockGame({ id: 'game-123' })
      mockGameRepository.findById.mockResolvedValue(game)
      mockRoomRepository.create.mockResolvedValue({ status: 'limit_reached' })

      await expect(
        useCase.execute({
          name: 'Test Room',
          hostId: 'host-123',
          gameId: 'game-123',
          discordLink: 'https://discord.gg/test',
        })
      ).rejects.toThrow(RoomCreateLimitReachedError)

      expect(mockRoomRepository.create).toHaveBeenCalledOnce()
    })

    describe('Discord invite check', () => {
      const input = {
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.com/invite/premier-qui?event=1',
      }

      beforeEach(() => {
        mockGameRepository.findById.mockResolvedValue(createMockGame({ id: 'game-123' }))
        mockRoomRepository.create.mockResolvedValue({
          status: 'created',
          room: createMockRoom({ gameId: 'game-123' }),
          hostMember: createMockRoomMember(),
        })
      })

      it('asks Discord about the code of the invite before creating the Squad', async () => {
        await useCase.execute(input)

        expect(mockDiscordPreviews.fetch).toHaveBeenCalledTimes(1)
        expect(mockDiscordPreviews.fetch).toHaveBeenCalledWith('premier-qui')
        expect(mockRoomRepository.create).toHaveBeenCalledOnce()
      })

      it('throws InvalidDiscordInviteError without creating the Squad for an invite Discord does not know', async () => {
        mockDiscordPreviews.fetch.mockResolvedValue({ kind: 'invalid' })

        await expect(useCase.execute(input)).rejects.toThrow(InvalidDiscordInviteError)
        expect(mockRoomRepository.create).not.toHaveBeenCalled()
      })

      it('does not ask Discord when the game is refused first', async () => {
        mockGameRepository.findById.mockResolvedValue(null)

        await expect(useCase.execute(input)).rejects.toThrow(InvalidGameError)
        expect(mockDiscordPreviews.fetch).not.toHaveBeenCalled()
      })

      it.each<DiscordInvitePreviewOutcome>([
        { kind: 'rate_limited' },
        { kind: 'unreachable' },
        {
          kind: 'found',
          preview: {
            name: 'Expiring',
            iconUrl: null,
            backdropUrl: null,
            memberCount: null,
            onlineCount: null,
            expiresAt: '2026-11-01T12:00:00+00:00',
          },
        },
      ])('creates the Squad when Discord answers $kind', async (outcome) => {
        mockDiscordPreviews.fetch.mockResolvedValue(outcome)

        const result = await useCase.execute(input)

        expect(result.room).toBeDefined()
        expect(mockRoomRepository.create).toHaveBeenCalledOnce()
      })

      it('refuses a link with no invite code without asking Discord', async () => {
        await expect(
          useCase.execute({ ...input, discordLink: 'https://discord.gg/' })
        ).rejects.toThrow(InvalidDiscordInviteError)
        expect(mockDiscordPreviews.fetch).not.toHaveBeenCalled()
      })
    })

    it('should allow room creation when user hosts 2 valid rooms (below limit)', async () => {
      const game = createMockGame({ id: 'game-123', maxPlayers: 5 })
      mockGameRepository.findById.mockResolvedValue(game)

      const expectedRoom = createMockRoom({
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        maxPlayers: 5,
      })
      mockRoomRepository.create.mockResolvedValue({
        status: 'created',
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
