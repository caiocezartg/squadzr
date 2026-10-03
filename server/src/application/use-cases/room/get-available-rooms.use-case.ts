import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { Clock } from '@domain/services/clock.interface'

export interface GetAvailableRoomsInput {
  readonly userId?: string
}

export type AvailableRoom = Room & { isMember?: boolean }

export interface GetAvailableRoomsOutput {
  readonly rooms: AvailableRoom[]
}

export interface IGetAvailableRoomsUseCase {
  execute(input?: GetAvailableRoomsInput): Promise<GetAvailableRoomsOutput>
}

export class GetAvailableRoomsUseCase implements IGetAvailableRoomsUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository,
    private readonly clock: Clock
  ) {}

  async execute(input?: GetAvailableRoomsInput): Promise<GetAvailableRoomsOutput> {
    // The catalog lists valid Open Rooms only: Ready Rooms leave immediately
    // and expired Open Rooms are gone even before physical deletion.
    const rooms = await this.roomRepository.findAvailable(this.clock.now())

    if (input?.userId) {
      const memberships = await this.roomMemberRepository.findByUserId(input.userId)
      const memberRoomIds = new Set(memberships.map((m) => m.roomId))

      return {
        rooms: rooms.map((room) => ({
          ...room,
          isMember: memberRoomIds.has(room.id),
        })),
      }
    }

    return { rooms }
  }
}
