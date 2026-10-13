import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'

/**
 * Loads the Squad with this code. A missing Squad and an expired one are both
 * absent. Expiration is decided by the injected clock, never by the scheduler row.
 */
export async function findUnexpiredRoomByCode(
  rooms: IRoomRepository,
  clock: Clock,
  code: string
): Promise<Room | null> {
  const room = await rooms.findByCode(code)
  if (!room || isRoomExpired(room, clock.now(), ROOM)) return null
  return room
}
