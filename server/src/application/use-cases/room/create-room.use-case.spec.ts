import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CreateRoomUseCase } from './create-room.use-case'
import type {
  DiscordInviteChannel,
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import {
  DiscordInviteNotVoiceCallError,
  DiscordUnavailableError,
  GameNotAvailableError,
  InvalidDiscordInviteError,
  InvalidGameError,
  PlatformNotAvailableError,
  RoomCreateLimitReachedError,
  RoomJoinLimitReachedError,
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
import { ROOM } from '@config/constants'

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
          channel: { id: '1234', name: 'Squad call', kind: 'voice' },
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
        discordCall: { id: '1234', name: 'Squad call' },
        platform: null,
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

    it('should throw RoomJoinLimitReachedError when the transaction reports the Membership limit', async () => {
      const game = createMockGame({ id: 'game-123' })
      mockGameRepository.findById.mockResolvedValue(game)
      mockRoomRepository.create.mockResolvedValue({ status: 'join_limit_reached' })

      const attempt = useCase.execute({
        name: 'Test Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      })

      await expect(attempt).rejects.toThrow(RoomJoinLimitReachedError)
      await expect(attempt).rejects.toMatchObject({
        code: 'ROOM_JOIN_LIMIT_REACHED',
        message: `You can only be in ${ROOM.JOIN_LIMIT} open squads at a time`,
      })
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

      const foundWith = (
        channel: DiscordInviteChannel | null,
        expiresAt: string | null = null
      ): DiscordInvitePreviewOutcome => ({
        kind: 'found',
        preview: {
          name: 'Server',
          iconUrl: null,
          backdropUrl: null,
          memberCount: null,
          onlineCount: null,
          expiresAt,
          channel,
        },
      })

      it.each<[string, DiscordInviteChannel]>([
        ['a voice channel', { id: '11', name: 'Ranked call', kind: 'voice' }],
        ['a stage channel', { id: '12', name: 'Stage', kind: 'stage' }],
      ])(
        'stores the id and name of the call when the invite points to %s',
        async (_label, channel) => {
          mockDiscordPreviews.fetch.mockResolvedValue(foundWith(channel))

          await useCase.execute(input)

          expect(mockRoomRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ discordCall: { id: channel.id, name: channel.name } })
          )
        }
      )

      it('creates the Squad for an invite that expires, as the create form only warns about it', async () => {
        mockDiscordPreviews.fetch.mockResolvedValue(
          foundWith({ id: '11', name: 'Call', kind: 'voice' }, '2026-11-01T12:00:00+00:00')
        )

        const result = await useCase.execute(input)

        expect(result.room).toBeDefined()
        expect(mockRoomRepository.create).toHaveBeenCalledOnce()
      })

      it.each<[string, DiscordInviteChannel | null]>([
        ['a text channel', { id: '13', name: 'general', kind: 'other' }],
        ['no channel', null],
      ])(
        'throws DiscordInviteNotVoiceCallError without creating the Squad when the invite points to %s',
        async (_label, channel) => {
          mockDiscordPreviews.fetch.mockResolvedValue(foundWith(channel))

          await expect(useCase.execute(input)).rejects.toThrow(DiscordInviteNotVoiceCallError)
          expect(mockRoomRepository.create).not.toHaveBeenCalled()
        }
      )

      it.each<[DiscordInvitePreviewOutcome, number | undefined]>([
        [{ kind: 'rate_limited', retryAfterMs: 1500 }, 1500],
        [{ kind: 'rate_limited' }, undefined],
        [{ kind: 'unreachable' }, undefined],
        [{ kind: 'unreachable', status: 503 }, undefined],
      ])(
        'throws DiscordUnavailableError without creating the Squad when Discord answers %j',
        async (outcome, retryAfterMs) => {
          mockDiscordPreviews.fetch.mockResolvedValue(outcome)

          const error = await useCase.execute(input).catch((thrown: unknown) => thrown)

          expect(error).toBeInstanceOf(DiscordUnavailableError)
          expect((error as DiscordUnavailableError).retryAfterMs).toBe(retryAfterMs)
          expect(mockRoomRepository.create).not.toHaveBeenCalled()
        }
      )

      it('never reads a call sent with the input', async () => {
        mockDiscordPreviews.fetch.mockResolvedValue(
          foundWith({ id: '11', name: 'Ranked call', kind: 'voice' })
        )

        await useCase.execute({
          ...input,
          discordCall: { id: 'sent', name: 'Sent by the client' },
        } as typeof input)

        expect(mockRoomRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ discordCall: { id: '11', name: 'Ranked call' } })
        )
      })

      it('refuses a link with no invite code without asking Discord', async () => {
        await expect(
          useCase.execute({ ...input, discordLink: 'https://discord.gg/' })
        ).rejects.toThrow(InvalidDiscordInviteError)
        expect(mockDiscordPreviews.fetch).not.toHaveBeenCalled()
      })
    })

    it('should allow room creation when the transaction finds the user below both limits', async () => {
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

    describe('platform', () => {
      const baseInput = {
        name: 'My Room',
        hostId: 'host-123',
        gameId: 'game-123',
        discordLink: 'https://discord.gg/test',
      }

      beforeEach(() => {
        mockRoomRepository.create.mockResolvedValue({
          status: 'created',
          room: createMockRoom({ gameId: 'game-123' }),
          hostMember: createMockRoomMember(),
        })
      })

      it('stores the platform when it is one of the Game platforms', async () => {
        mockGameRepository.findById.mockResolvedValue(
          createMockGame({ id: 'game-123', platforms: ['pc', 'ps5', 'switch'] })
        )

        await useCase.execute({ ...baseInput, platform: 'ps5' })

        expect(mockRoomRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ platform: 'ps5' })
        )
      })

      it('accepts the only platform of a Game that has just one', async () => {
        mockGameRepository.findById.mockResolvedValue(
          createMockGame({ id: 'game-123', platforms: ['mobile'] })
        )

        await useCase.execute({ ...baseInput, platform: 'mobile' })

        expect(mockRoomRepository.create).toHaveBeenCalledWith(
          expect.objectContaining({ platform: 'mobile' })
        )
      })

      it.each([
        ['a platform the Game does not have', 'xbox-one'],
        ['no platform', undefined],
        ['a null platform', null],
      ] as const)('refuses %s when the Game has platforms', async (_label, platform) => {
        mockGameRepository.findById.mockResolvedValue(
          createMockGame({ id: 'game-123', platforms: ['pc', 'ps5'] })
        )

        await expect(useCase.execute({ ...baseInput, platform })).rejects.toBeInstanceOf(
          PlatformNotAvailableError
        )
        expect(mockRoomRepository.create).not.toHaveBeenCalled()
      })

      it.each([undefined, null] as const)(
        'stores no platform when the Game has none and the input says %s',
        async (platform) => {
          mockGameRepository.findById.mockResolvedValue(
            createMockGame({ id: 'game-123', platforms: [] })
          )

          await useCase.execute({ ...baseInput, platform })

          expect(mockRoomRepository.create).toHaveBeenCalledWith(
            expect.objectContaining({ platform: null })
          )
        }
      )

      it('refuses a platform for a Game that has none', async () => {
        mockGameRepository.findById.mockResolvedValue(
          createMockGame({ id: 'game-123', platforms: [] })
        )

        const error = await useCase
          .execute({ ...baseInput, platform: 'pc' })
          .catch((caught: unknown) => caught)

        expect(error).toBeInstanceOf(PlatformNotAvailableError)
        expect(error).toMatchObject({ statusCode: 400, code: 'INVALID_PLATFORM' })
        expect(mockRoomRepository.create).not.toHaveBeenCalled()
      })
    })
  })
})
