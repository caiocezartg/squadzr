import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { Clock } from '@domain/services/clock.interface'
import { NotRoomMemberError, RoomNotFoundError, RoomReadyError } from '@application/errors'
import { resolveAccessibleRoom } from './resolve-accessible-room'

export interface LeaveRoomInput {
  readonly code: string
  readonly userId: string
}

export interface LeaveRoomOutput {
  readonly roomId: string
  readonly roomCode: string
  readonly wasHostLeave: boolean
  readonly memberCount: number
}

export interface ILeaveRoomUseCase {
  execute(input: LeaveRoomInput): Promise<LeaveRoomOutput>
}

export class LeaveRoomUseCase implements ILeaveRoomUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: LeaveRoomInput): Promise<LeaveRoomOutput> {
    const { room } = await resolveAccessibleRoom(
      this.roomRepository,
      this.roomMemberRepository,
      this.clock,
      { code: input.code, viewerId: input.userId }
    )

    // The repository locks the room and decides readiness, host deletion and
    // Room Activity inside one transaction, so no Membership change can slip
    // through after the room became Ready.
    const outcome = await this.roomMemberRepository.leaveOpenRoom({
      roomId: room.id,
      userId: input.userId,
    })

    switch (outcome.status) {
      case 'left':
        return {
          roomId: room.id,
          roomCode: room.code,
          wasHostLeave: outcome.wasHost,
          memberCount: outcome.memberCount,
        }
      case 'not_member':
        throw new NotRoomMemberError(input.userId, room.id)
      case 'ready':
        throw new RoomReadyError(room.id)
      case 'not_found':
        throw new RoomNotFoundError(room.id)
    }
  }
}
