import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IGameRepository } from '@domain/repositories/game.repository'
import type { Clock } from '@domain/services/clock.interface'
import { InvalidGameError, RoomCreateLimitReachedError } from '@application/errors'
import { ROOM } from '@config/constants'

export interface CreateRoomInput {
  readonly name: string
  readonly hostId: string
  readonly gameId: string
  readonly maxPlayers?: number
  readonly discordLink: string
  readonly tags?: string[]
  readonly language?: 'en' | 'pt-br'
}

export interface CreateRoomOutput {
  readonly room: Room
  readonly hostMember: RoomMember
}

export interface ICreateRoomUseCase {
  execute(input: CreateRoomInput): Promise<CreateRoomOutput>
}

export class CreateRoomUseCase implements ICreateRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly gameRepository: IGameRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateRoomInput): Promise<CreateRoomOutput> {
    const game = await this.gameRepository.findById(input.gameId)
    if (!game) {
      throw new InvalidGameError(input.gameId)
    }

    const now = this.clock.now()

    // Enforce host limit: max 3 valid rooms (ready and expired rooms do not count).
    const activeRoomCount = await this.roomRepository.countActiveByHostId(input.hostId, now)
    if (activeRoomCount >= ROOM.CREATE_LIMIT) {
      throw new RoomCreateLimitReachedError(ROOM.CREATE_LIMIT)
    }

    const maxPlayers = input.maxPlayers ?? game.maxPlayers

    // Room and host Membership are one transaction, with Room Activity stamped
    // by the injected clock in the same statement as the room itself.
    return this.roomRepository.create(
      {
        name: input.name,
        hostId: input.hostId,
        gameId: input.gameId,
        maxPlayers,
        discordLink: input.discordLink,
        tags: input.tags,
        language: input.language,
      },
      now
    )
  }
}
