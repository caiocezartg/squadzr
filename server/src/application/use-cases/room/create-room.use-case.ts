import type { Game } from '@domain/entities/game.entity'
import type { NewRoom, Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import { voiceCallOf, type VoiceCall } from '@domain/services/voice-call'
import { discordInviteCode, type Platform } from '@squadzr/schemas'
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
import { ROOM } from '@config/constants'

export interface CreateRoomOutput {
  readonly room: Room
  readonly hostMember: RoomMember
}

/**
 * maxPlayers may be omitted: the game's capacity applies. The Voice Call is never an input: the server
 * resolves it from the invite, so a call sent by a client is not read.
 */
export type CreateRoomInput = Omit<NewRoom, 'maxPlayers' | 'discordCall'> & {
  readonly maxPlayers?: number
}

export interface ICreateRoomUseCase {
  execute(input: CreateRoomInput): Promise<CreateRoomOutput>
}

export class CreateRoomUseCase implements ICreateRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly gameRepository: IGameRepository,
    private readonly userRepository: IUserRepository,
    private readonly discordPreviews: DiscordInvitePreviewProvider
  ) {}

  async execute(input: CreateRoomInput): Promise<CreateRoomOutput> {
    const game = await this.gameRepository.findById(input.gameId)
    if (!game) {
      throw new InvalidGameError(input.gameId)
    }

    // A Game removed from the catalog is still readable by id, but no new Squad
    // may point at it.
    if (!game.listed) {
      throw new GameNotAvailableError(input.gameId)
    }

    const platform = this.resolvePlatform(game, input)

    const discordCall = await this.resolveVoiceCall(input.discordLink)

    // A new Squad has only its host, so the host's entry is the whole preview.
    // Read before creating: a missing host fails here, before any Squad exists.
    const host = await this.userRepository.findById(input.hostId)
    if (!host) {
      throw new UserNotFoundError(input.hostId)
    }

    const maxPlayers = input.maxPlayers ?? game.maxPlayers

    // Room and host Membership are one transaction, with Room Activity stamped
    // by the repository's clock after the user row lock. The host limit uses
    // that same instant inside the transaction.
    const outcome = await this.roomRepository.create({
      name: input.name,
      hostId: input.hostId,
      gameId: input.gameId,
      maxPlayers,
      discordLink: input.discordLink,
      discordCall,
      tags: input.tags,
      language: input.language,
      platform,
    })

    if (outcome.status === 'limit_reached') {
      throw new RoomCreateLimitReachedError(ROOM.CREATE_LIMIT)
    }
    if (outcome.status === 'join_limit_reached') {
      throw new RoomJoinLimitReachedError(ROOM.JOIN_LIMIT)
    }

    // The Game read to validate `gameId` is the one the response and the
    // `room_created` broadcast carry: the create path never reads it again.
    return {
      room: {
        ...outcome.room,
        game,
        memberPreview: [{ id: host.id, name: host.name, image: host.avatarUrl }],
      },
      hostMember: outcome.hostMember,
    }
  }

  /**
   * A Game with platforms needs one of them; a Game without any takes none. Anything else
   * is refused, so a Squad never carries a platform its Game cannot be played on.
   */
  private resolvePlatform(game: Game, input: CreateRoomInput): Platform | null {
    const platform = input.platform ?? null
    if (game.platforms.length === 0) {
      if (platform !== null) throw new PlatformNotAvailableError(game.id, platform)
      return null
    }
    if (platform === null || !game.platforms.includes(platform)) {
      throw new PlatformNotAvailableError(game.id, platform)
    }
    return platform
  }

  /**
   * Resolves the Voice Call the invite points to, which the Squad stores: a Squad always has one. An invite
   * Discord does not know, or one whose channel is no Voice Call, is refused. Discord being slow, down or
   * rate limiting is refused too (503, with Discord's `retry_after` when it gave one): without an answer
   * there is no call to store. An invite that expires is allowed: the create form warns about it.
   */
  private async resolveVoiceCall(discordLink: string): Promise<VoiceCall> {
    const inviteCode = discordInviteCode(discordLink)
    if (!inviteCode) throw new InvalidDiscordInviteError()

    const outcome = await this.discordPreviews.fetch(inviteCode)
    switch (outcome.kind) {
      case 'invalid':
        throw new InvalidDiscordInviteError()
      case 'rate_limited':
        throw new DiscordUnavailableError(outcome.retryAfterMs)
      case 'unreachable':
        throw new DiscordUnavailableError()
      case 'found': {
        const call = voiceCallOf(outcome.preview)
        if (!call) throw new DiscordInviteNotVoiceCallError()
        return call
      }
    }
  }
}
