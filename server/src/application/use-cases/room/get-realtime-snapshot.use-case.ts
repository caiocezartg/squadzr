import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { roomExpiresAt } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { RoomNotFoundError, UnauthorizedError, AppError } from '@application/errors'
import { GetRoomByCodeUseCase, type RoomPlayer } from './get-room-by-code.use-case'

export interface RealtimeSnapshot {
  readonly room: Room
  readonly players: RoomPlayer[]
  readonly expiresAt: Date
}

class RealtimeMembershipRequiredError extends AppError {
  readonly statusCode = 403
  readonly code = 'NOT_ROOM_MEMBER'
  constructor() {
    super('You are not a member of this room')
  }
}

export interface IGetRealtimeSnapshotUseCase {
  subscribe(code: string, userId: string | null): Promise<RealtimeSnapshot & { userId: string }>
  /** Internal post-commit publication; never exposed to a guest socket. */
  read(code: string): Promise<RealtimeSnapshot | null>
}

export class GetRealtimeSnapshotUseCase implements IGetRealtimeSnapshotUseCase {
  private readonly getRoom: GetRoomByCodeUseCase

  constructor(
    private readonly rooms: IRoomRepository,
    members: IRoomMemberRepository,
    users: IUserRepository,
    clock: Clock
  ) {
    this.getRoom = new GetRoomByCodeUseCase(rooms, members, users, clock)
  }

  async subscribe(
    code: string,
    userId: string | null
  ): Promise<RealtimeSnapshot & { userId: string }> {
    if (!userId) throw new UnauthorizedError()
    const result = await this.getRoom.execute({ code, viewerId: userId })
    if (!result.room) throw new RoomNotFoundError(code)
    if (!result.isMember) throw new RealtimeMembershipRequiredError()
    return { ...this.snapshot(result.room, result.players), userId }
  }

  async read(code: string): Promise<RealtimeSnapshot | null> {
    const room = await this.rooms.findByCode(code)
    if (!room) return null
    const result = await this.getRoom.execute({ code, viewerId: room.hostId })
    return result.room && result.isMember ? this.snapshot(result.room, result.players) : null
  }

  private snapshot(room: Room, players: RoomPlayer[]): RealtimeSnapshot {
    return { room, players, expiresAt: roomExpiresAt(room, ROOM) }
  }
}
