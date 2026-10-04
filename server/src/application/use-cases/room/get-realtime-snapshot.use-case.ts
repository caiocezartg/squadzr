import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired, roomExpiresAt } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { RoomNotFoundError, UnauthorizedError, NotRoomMemberError } from '@application/errors'
import { GetRoomByCodeUseCase, type RoomPlayer } from './get-room-by-code.use-case'
import { findRoomPlayers } from './find-room-players'

export interface RealtimeSnapshot {
  readonly room: Room
  readonly players: RoomPlayer[]
  readonly expiresAt: Date
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
    private readonly members: IRoomMemberRepository,
    private readonly users: IUserRepository,
    private readonly clock: Clock
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
    if (!result.isMember) throw new NotRoomMemberError(userId, result.room.id)
    return { ...this.snapshot(result.room, result.players), userId }
  }

  async read(code: string): Promise<RealtimeSnapshot | null> {
    const room = await this.rooms.findByCode(code)
    if (!room || isRoomExpired(room, this.clock.now(), ROOM)) return null
    return this.snapshot(room, await findRoomPlayers(room, this.members, this.users))
  }

  private snapshot(room: Room, players: RoomPlayer[]): RealtimeSnapshot {
    return { room, players, expiresAt: roomExpiresAt(room, ROOM) }
  }
}
