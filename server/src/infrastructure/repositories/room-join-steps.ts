import { and, count, eq, gt, isNull } from 'drizzle-orm'
import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import type {
  JoinOpenRoomInput,
  JoinOpenRoomOutcome,
} from '@domain/repositories/room-member.repository'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { user } from '@infrastructure/database/schema/auth'
import { roomMembers, type RoomMemberRow } from '@infrastructure/database/schema/room-members'
import { rooms, type RoomRow } from '@infrastructure/database/schema/rooms'
import { userNotifications } from '@infrastructure/database/schema/user-notifications'
import {
  mapUserNotificationRow,
  notificationInputToRow,
} from './drizzle-user-notification.repository'
import { mapRoomMemberRowToEntity } from './room-mapping'
import type { DatabaseTransaction } from './user-lock'

// The named steps of `DrizzleRoomMemberRepository.joinOpenRoom`. Each step takes the
// transaction handle, so every statement of a join shares one pool connection.

type JoinedOutcome = Extract<JoinOpenRoomOutcome, { readonly status: 'joined' }>
type ReadyNotificationsBuilder = NonNullable<JoinOpenRoomInput['buildReadyNotifications']>

/** Validate result: answered without a new seat, or admitted with the seats taken so far. */
export type JoinValidation =
  | { readonly admitted: false; readonly outcome: JoinOpenRoomOutcome }
  | { readonly admitted: true; readonly currentCount: number }

/** Insert result: the Membership this join wrote, or the one a concurrent duplicate wrote. */
export interface MembershipInsert {
  readonly created: boolean
  readonly member: RoomMember
}

/**
 * The only constructor of a `joined` outcome. Every successful join and every
 * idempotent answer returns through it, so the outcome shape cannot drift.
 */
export function joinedOutcome(fields: Omit<JoinedOutcome, 'status'>): JoinedOutcome {
  return {
    status: 'joined',
    member: fields.member,
    memberCount: fields.memberCount,
    becameReady: fields.becameReady,
    notifications: fields.notifications,
  }
}

/** Lock step: the room row, `FOR UPDATE`, so joins and leaves on this Room serialize here. */
export async function lockRoomRow(
  tx: DatabaseTransaction,
  roomId: string
): Promise<RoomRow | null> {
  const rows = await tx.select().from(rooms).where(eq(rooms.id, roomId)).limit(1).for('update')
  return rows[0] ?? null
}

/**
 * Validate step: every answer that writes no Membership, decided in the order the
 * join contract requires. It runs under the room and user locks, so its reads stay
 * valid until the transaction ends.
 */
export async function validateJoin(
  tx: DatabaseTransaction,
  input: { readonly room: Room; readonly userId: string; readonly now: Date }
): Promise<JoinValidation> {
  const { room, userId, now } = input
  if (isRoomExpired(room, now, ROOM)) return withoutSeat({ status: 'expired' })

  // Idempotent for an existing member: never answered with a seat or limit error.
  const existing = await findMembershipRow(tx, room.id, userId)
  if (existing) {
    return withoutSeat(
      joinedOutcome({
        member: mapRoomMemberRowToEntity(existing),
        memberCount: await countRoomMembers(tx, room.id),
        becameReady: false,
        notifications: [],
      })
    )
  }

  if ((await countActiveMemberships(tx, userId, now)) >= ROOM.JOIN_LIMIT) {
    return withoutSeat({ status: 'limit_reached' })
  }

  // Capacity is decided before readiness, so the loser of a race for the last seat
  // keeps the established ROOM_FULL answer.
  const currentCount = await countRoomMembers(tx, room.id)
  if (currentCount >= room.maxPlayers) {
    return withoutSeat({ status: 'full', memberCount: currentCount })
  }
  if (room.readyAt) return withoutSeat({ status: 'ready' })

  return { admitted: true, currentCount }
}

/**
 * Insert step: writes this user's Membership, or resolves a concurrent duplicate of
 * it. A duplicate is idempotent and moves no Room Activity.
 */
export async function insertMembership(
  tx: DatabaseTransaction,
  input: { readonly roomId: string; readonly userId: string; readonly joinedAt: Date }
): Promise<MembershipInsert> {
  const insertedRows = await tx
    .insert(roomMembers)
    .values(input)
    .onConflictDoNothing({ target: [roomMembers.roomId, roomMembers.userId] })
    .returning()

  const inserted = insertedRows[0]
  if (inserted) return { created: true, member: mapRoomMemberRowToEntity(inserted) }

  const existing = await findMembershipRow(tx, input.roomId, input.userId)
  if (!existing) throw new Error('Failed to load the existing room membership')
  return { created: false, member: mapRoomMemberRowToEntity(existing) }
}

/**
 * Activity step: a join advances Room Activity, and the join that takes the last seat
 * also sets readiness, from the same instant.
 */
export async function advanceRoomActivity(
  tx: DatabaseTransaction,
  input: { readonly roomId: string; readonly now: Date; readonly becameReady: boolean }
): Promise<void> {
  await tx
    .update(rooms)
    .set({
      lastActivityAt: input.now,
      updatedAt: input.now,
      ...(input.becameReady && { readyAt: input.now }),
    })
    .where(eq(rooms.id, input.roomId))
}

/**
 * Emit step: persists one `room_ready` notification per roster member in the join
 * transaction, so a failure here rolls the readiness and the Membership back too. The
 * builder is pure and the roster reads use the same connection, so the lock never
 * waits for a second pool connection.
 */
export async function emitReadyNotifications(
  tx: DatabaseTransaction,
  input: { readonly roomId: string; readonly buildReadyNotifications: ReadyNotificationsBuilder }
): Promise<UserNotification[]> {
  const roster = await loadRoster(tx, input.roomId)
  const inputs = input.buildReadyNotifications(roster.members, roster.users)
  if (inputs.length === 0) return []

  const notificationRows = await tx
    .insert(userNotifications)
    .values(inputs.map(notificationInputToRow))
    .onConflictDoNothing({
      target: [userNotifications.roomId, userNotifications.userId, userNotifications.type],
    })
    .returning()
  return notificationRows.map(mapUserNotificationRow)
}

function withoutSeat(outcome: JoinOpenRoomOutcome): JoinValidation {
  return { admitted: false, outcome }
}

/** This user's Membership in this Room, if there is one. */
async function findMembershipRow(
  tx: DatabaseTransaction,
  roomId: string,
  userId: string
): Promise<RoomMemberRow | undefined> {
  const rows = await tx
    .select()
    .from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
    .limit(1)
  return rows[0]
}

/** Memberships of one Room, read under the room lock. */
async function countRoomMembers(tx: DatabaseTransaction, roomId: string): Promise<number> {
  const rows = await tx
    .select({ currentCount: count() })
    .from(roomMembers)
    .where(eq(roomMembers.roomId, roomId))
  return rows[0]?.currentCount ?? 0
}

/**
 * Memberships of this user in valid Open Rooms. A Ready Room is done, and an Open
 * Room past its activity window is gone even before the scheduler deletes it.
 */
async function countActiveMemberships(
  tx: DatabaseTransaction,
  userId: string,
  now: Date
): Promise<number> {
  const rows = await tx
    .select({ currentCount: count() })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(
      and(
        eq(roomMembers.userId, userId),
        isNull(rooms.readyAt),
        gt(rooms.lastActivityAt, openRoomCutoff(now))
      )
    )
  return rows[0]?.currentCount ?? 0
}

function openRoomCutoff(now: Date): Date {
  return new Date(now.getTime() - ROOM.OPEN_ROOM_TTL_MS)
}

/** Members and profiles as they stand under the join's locks, not as they were before. */
async function loadRoster(tx: DatabaseTransaction, roomId: string) {
  const memberRows = await tx
    .select({
      member: roomMembers,
      user: { id: user.id, name: user.name, avatarUrl: user.image },
    })
    .from(roomMembers)
    .innerJoin(user, eq(user.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, roomId))
  return {
    members: memberRows.map((row) => mapRoomMemberRowToEntity(row.member)),
    users: memberRows.map((row) => row.user),
  }
}
