import { and, gt, isNull } from 'drizzle-orm'
import { ROOM } from '@config/constants'
import { rooms } from '@infrastructure/database/schema/rooms'

/** Instant before which an Open Room's Room Activity no longer keeps it open. */
export function openRoomCutoff(now: Date): Date {
  return new Date(now.getTime() - ROOM.OPEN_ROOM_TTL_MS)
}

/** The same rule as `validOpenRoomCondition`, for a row already read (and locked) by the caller. */
export function isValidOpenRoom(
  room: { readonly readyAt: Date | null; readonly lastActivityAt: Date },
  now: Date
): boolean {
  return room.readyAt === null && room.lastActivityAt > openRoomCutoff(now)
}

/** Open Rooms whose Room Activity is still inside the 24h window. */
export function validOpenRoomCondition(now: Date) {
  return and(isNull(rooms.readyAt), gt(rooms.lastActivityAt, openRoomCutoff(now)))
}
