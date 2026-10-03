import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import { RoomReadyError } from '@application/errors'

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
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository
  ) {}

  async execute(input: LeaveRoomInput): Promise<LeaveRoomOutput> {
    // Block leaving a ready (full) room
    const room = await this.roomRepository.findById(input.roomId)
    if (room?.readyAt) {
      throw new RoomReadyError(input.roomId)
    }

    const deleted = await this.roomMemberRepository.delete(input.roomId, input.userId)

    if (!deleted) {
      return { success: false, wasHostLeave: false, memberCount: 0 }
    }

    const wasHostLeave = room !== null && room.hostId === input.userId

    if (wasHostLeave) {
      await this.roomMemberRepository.deleteByRoomId(input.roomId)
      await this.roomRepository.delete(input.roomId)
      return { success: true, wasHostLeave: true, memberCount: 0 }
    }

    const memberCount = await this.roomMemberRepository.countByRoomId(input.roomId)
    return { success: true, wasHostLeave: false, memberCount }
  }
}
