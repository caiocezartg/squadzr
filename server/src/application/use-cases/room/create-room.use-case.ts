import type { NewRoom, Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IGameRepository } from '@domain/repositories/game.repository'
import {
  GameNotAvailableError,
  InvalidGameError,
  RoomCreateLimitReachedError,
} from '@application/errors'
import { ROOM } from '@config/constants'

export interface CreateRoomOutput {
  readonly room: Room
  readonly hostMember: RoomMember
}

/** maxPlayers may be omitted: the game's capacity applies. */
export type CreateRoomInput = Omit<NewRoom, 'maxPlayers'> & { readonly maxPlayers?: number }

export interface ICreateRoomUseCase {
  execute(input: CreateRoomInput): Promise<CreateRoomOutput>
}

export class CreateRoomUseCase implements ICreateRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly gameRepository: IGameRepository
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
      tags: input.tags,
      language: input.language,
    })

    if (outcome.status === 'limit_reached') {
      throw new RoomCreateLimitReachedError(ROOM.CREATE_LIMIT)
    }

    return { room: outcome.room, hostMember: outcome.hostMember }
  }
}
