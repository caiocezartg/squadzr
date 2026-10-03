import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import { RoomNotFoundError, RoomReadyError } from '@application/errors'

export interface LeaveRoomInput {
  readonly roomId: string
  readonly userId: string
}

export interface LeaveRoomOutput {
  readonly success: boolean
  readonly wasHostLeave: boolean
  readonly memberCount: number
}

export interface ILeaveRoomUseCase {
  execute(input: LeaveRoomInput): Promise<LeaveRoomOutput>
}

export class LeaveRoomUseCase implements ILeaveRoomUseCase {
  constructor(private readonly roomMemberRepository: IRoomMemberRepository) {}

  async execute(input: LeaveRoomInput): Promise<LeaveRoomOutput> {
    // The repository locks the room and decides readiness, host deletion and
    // Room Activity inside one transaction, so no Membership change can slip
    // through after the room became Ready.
    const outcome = await this.roomMemberRepository.leaveOpenRoom({
      roomId: input.roomId,
      userId: input.userId,
    })

    switch (outcome.status) {
      case 'left':
        return {
          success: true,
          wasHostLeave: outcome.wasHost,
          memberCount: outcome.memberCount,
        }
      case 'not_member':
        return { success: false, wasHostLeave: false, memberCount: 0 }
      case 'ready':
        throw new RoomReadyError(input.roomId)
      case 'not_found':
        throw new RoomNotFoundError(input.roomId)
    }
  }
}
