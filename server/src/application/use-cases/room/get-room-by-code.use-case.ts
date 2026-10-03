import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'

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
  /** Null when the room does not exist, expired, or is a Ready Room read by a non-member. */
  readonly room: Room | null
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
    const room = await this.roomRepository.findByCode(input.code)
    if (!room) {
      return { room: null, isMember: false, players: [] }
    }

    const isMember = await this.isMember(room.id, input.viewerId)

    // Expiration is decided by the injected clock, never by the scheduler row.
    if (isRoomExpired(room, this.clock.now(), ROOM)) {
      return { room: null, isMember: false, players: [] }
    }

    // A Ready Room is accessible only to its members, during retention.
    if (room.readyAt && !isMember) {
      return { room: null, isMember: false, players: [] }
    }

    if (!isMember) {
      return { room, isMember: false, players: [] }
    }

    return { room, isMember: true, players: await this.findPlayers(room) }
  }

  private async isMember(roomId: string, viewerId: string | undefined): Promise<boolean> {
    if (!viewerId) return false
    const membership = await this.roomMemberRepository.findByRoomAndUser(roomId, viewerId)
    return membership !== null
  }

  private async findPlayers(room: Room): Promise<RoomPlayer[]> {
    const members = await this.roomMemberRepository.findByRoomId(room.id)
    const userIds = members.map((m) => m.userId)
    const users = await this.userRepository.findByIds(userIds)
    const userMap = new Map(users.map((u) => [u.id, u]))

    return members
      .map((m) => {
        const user = userMap.get(m.userId)
        if (!user) return null
        return {
          id: user.id,
          name: user.name,
          image: user.avatarUrl,
          isHost: user.id === room.hostId,
        }
      })
      .filter((p): p is RoomPlayer => p !== null)
  }
}
