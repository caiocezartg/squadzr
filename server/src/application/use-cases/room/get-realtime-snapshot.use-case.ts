import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { Clock } from '@domain/services/clock.interface'
import { findRoomPlayers } from './helpers/find-room-players'
import { findUnexpiredRoomByCode } from './helpers/find-unexpired-room-by-code'
import { buildRealtimeSnapshot, type RealtimeSnapshot } from './helpers/realtime-snapshot'

export interface GetRealtimeSnapshotInput {
  readonly code: string
}

export type GetRealtimeSnapshotOutput = RealtimeSnapshot | null

export interface IGetRealtimeSnapshotUseCase {
  /** Internal post-commit publication; never exposed to a guest socket. */
  execute(input: GetRealtimeSnapshotInput): Promise<GetRealtimeSnapshotOutput>
}

export class GetRealtimeSnapshotUseCase implements IGetRealtimeSnapshotUseCase {
  constructor(
    private readonly rooms: IRoomRepository,
    private readonly members: IRoomMemberRepository,
    private readonly users: IUserRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: GetRealtimeSnapshotInput): Promise<GetRealtimeSnapshotOutput> {
    const room = await findUnexpiredRoomByCode(this.rooms, this.clock, input.code)
    if (!room) return null
    return buildRealtimeSnapshot(room, await findRoomPlayers(room, this.members, this.users))
  }
}
