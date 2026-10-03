import type { Room } from '@domain/entities/room.entity'

/** Retention windows of the two room clocks, supplied by the caller's config. */
export interface RoomLifecycleWindows {
  /** An Open Room expires this long after its last durable Membership change. */
  readonly OPEN_ROOM_TTL_MS: number
  /** A Ready Room stays accessible to its members this long after `readyAt`. */
  readonly READY_ROOM_RETENTION_MS: number
}

/**
 * Instant at which the room stops being queryable, joinable and counted. An
 * Open Room is anchored on Room Activity; a Ready Room on its readiness.
 */
export function roomExpiresAt(
  room: Pick<Room, 'readyAt' | 'lastActivityAt'>,
  windows: RoomLifecycleWindows
): Date {
  if (room.readyAt) {
    return new Date(room.readyAt.getTime() + windows.READY_ROOM_RETENTION_MS)
  }
  return new Date(room.lastActivityAt.getTime() + windows.OPEN_ROOM_TTL_MS)
}

/**
 * True from the expiration instant on — even if the scheduler has not deleted
 * the row yet. Reads, joins and subscriptions must apply this before serving.
 */
export function isRoomExpired(
  room: Pick<Room, 'readyAt' | 'lastActivityAt'>,
  now: Date,
  windows: RoomLifecycleWindows
): boolean {
  return roomExpiresAt(room, windows).getTime() <= now.getTime()
}
