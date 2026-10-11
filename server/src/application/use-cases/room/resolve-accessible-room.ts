import type { Room } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { RoomNotFoundError } from '@application/errors'

export interface AccessibleRoomInput {
  readonly code: string
  /** Authenticated caller, if any. */
  readonly viewerId?: string
}

export interface AccessibleRoom {
  readonly room: Room
  /** True when `viewerId` holds a Membership in the room. */
  readonly isMember: boolean
}

/**
 * Resolves the Squad a viewer may act on. A missing or expired Squad, and a Ready
 * Squad seen by a non-member, all throw RoomNotFoundError: a non-member cannot tell
 * a Ready Squad from a missing one.
 */
export async function resolveAccessibleRoom(
  rooms: IRoomRepository,
  members: IRoomMemberRepository,
  clock: Clock,
  input: AccessibleRoomInput
): Promise<AccessibleRoom> {
  const room = await rooms.findByCode(input.code)
  if (!room) {
    throw new RoomNotFoundError(input.code)
  }

  const isMember = await isMemberOf(members, room.id, input.viewerId)

  // Expiration is decided by the injected clock, never by the scheduler row.
  if (isRoomExpired(room, clock.now(), ROOM)) {
    throw new RoomNotFoundError(input.code)
  }

  // A Ready Room is accessible only to its members, during retention.
  if (room.readyAt && !isMember) {
    throw new RoomNotFoundError(input.code)
  }

  return { room, isMember }
}

async function isMemberOf(
  members: IRoomMemberRepository,
  roomId: string,
  viewerId: string | undefined
): Promise<boolean> {
  if (!viewerId) return false
  const membership = await members.findByRoomAndUser(roomId, viewerId)
  return membership !== null
}
