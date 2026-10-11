import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { findRoomPlayers } from './find-room-players'
import { resolveAccessibleRoom } from './resolve-accessible-room'

export interface RoomPlayer {
  readonly id: string
  readonly name: string
  readonly image: string | null
  readonly isHost: boolean
}

export interface GetRoomByCodeInput {
  readonly code: string
  /** Authenticated caller, if any. The roster is resolved only for a member of the room. */
  readonly viewerId?: string
}

export interface GetRoomByCodeOutput {
  /** Never null: a missing, expired or hidden room throws RoomNotFoundError instead. */
  readonly room: Room
  /** True when `viewerId` holds a Membership in the room: only then may private details be shown. */
  readonly isMember: boolean
  readonly players: RoomPlayer[]
}

export interface IGetRoomByCodeUseCase {
  execute(input: GetRoomByCodeInput): Promise<GetRoomByCodeOutput>
}

export class GetRoomByCodeUseCase implements IGetRoomByCodeUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository,
    private readonly userRepository: IUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: GetRoomByCodeInput): Promise<GetRoomByCodeOutput> {
    const { room, isMember } = await resolveAccessibleRoom(
      this.roomRepository,
      this.roomMemberRepository,
      this.clock,
      input
    )

    if (!isMember) {
      return { room, isMember: false, players: [] }
    }

    return {
      room,
      isMember: true,
      players: await findRoomPlayers(room, this.roomMemberRepository, this.userRepository),
    }
  }
}
