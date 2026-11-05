import { and, count, eq } from 'drizzle-orm'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { rooms } from '@infrastructure/database/schema/rooms'
import { validOpenRoomCondition } from './open-room-rules'
import type { DatabaseTransaction } from './user-lock'

// The two per-user counts behind `ROOM.CREATE_LIMIT` and `ROOM.JOIN_LIMIT`. Both read
// on the transaction connection, under the user row lock of whoever is counted.

/** Valid Open Rooms this user hosts. A Ready Room is done, and an expired one is gone. */
export async function countHostedOpenRooms(
  tx: DatabaseTransaction,
  userId: string,
  now: Date
): Promise<number> {
  const rows = await tx
    .select({ currentCount: count() })
    .from(rooms)
    .where(and(eq(rooms.hostId, userId), validOpenRoomCondition(now)))
  return rows[0]?.currentCount ?? 0
}

/**
 * Memberships of this user in valid Open Rooms, the hosted ones included. A Ready Room
 * is done, and an Open Room past its activity window is gone even before the scheduler
 * deletes it.
 */
export async function countActiveMemberships(
  tx: DatabaseTransaction,
  userId: string,
  now: Date
): Promise<number> {
  const rows = await tx
    .select({ currentCount: count() })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(and(eq(roomMembers.userId, userId), validOpenRoomCondition(now)))
  return rows[0]?.currentCount ?? 0
}
