import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { Clock } from '@domain/services/clock.interface'

export type ExpiredRoomReason = 'open_expired' | 'ready_expired'

export interface DeletedRoom {
  readonly id: string
  readonly code: string
  readonly reason: ExpiredRoomReason
}

export interface DeleteExpiredRoomsOutput {
  readonly deletedRooms: DeletedRoom[]
}

export interface IDeleteExpiredRoomsUseCase {
  execute(): Promise<DeleteExpiredRoomsOutput>
}

export class DeleteExpiredRoomsUseCase implements IDeleteExpiredRoomsUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly clock: Clock
  ) {}

  async execute(): Promise<DeleteExpiredRoomsOutput> {
    const now = this.clock.now()
    const expiredRooms = await this.roomRepository.findExpiredRooms(now)

    const deletedRooms: DeletedRoom[] = []

    for (const room of expiredRooms) {
      // Conditional delete: a join that advanced Room Activity after the list
      // was read keeps the room alive instead of losing fresh state.
      const deleted = await this.roomRepository.deleteExpired(room.id, now)
      if (deleted) {
        deletedRooms.push({
          id: room.id,
          code: room.code,
          reason: room.readyAt ? 'ready_expired' : 'open_expired',
        })
      }
    }

    return { deletedRooms }
  }
}
