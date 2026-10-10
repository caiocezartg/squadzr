import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import type { IDeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'

export function createRoomCleanupUseCase(db: Database, clock: Clock): IDeleteExpiredRoomsUseCase {
  const roomRepository = new DrizzleRoomRepository(db, clock)

  return new DeleteExpiredRoomsUseCase(roomRepository, clock)
}
