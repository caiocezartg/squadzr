import { and, count, eq } from 'drizzle-orm'
import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { UserNotification } from '@domain/entities/user-notification.entity'
import type {
  JoinOpenRoomInput,
  JoinOpenRoomOutcome,
} from '@domain/repositories/room-member.repository'
import type { SquadDeparture } from '@domain/services/squad-release'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { user } from '@infrastructure/database/schema/auth'
import { roomMembers, type RoomMemberRow } from '@infrastructure/database/schema/room-members'
import { rooms, type RoomRow } from '@infrastructure/database/schema/rooms'
import { squadRecordMembers, squadRecords } from '@infrastructure/database/schema/squad-records'
import {
  roomReadyOnly,
  userNotifications,
} from '@infrastructure/database/schema/user-notifications'
import { countActiveMemberships } from './room-limits'
import { mapRoomMemberRowToEntity } from './room-mapping'
import { mapUserNotificationRow, notificationInputToRow } from './user-notification-mapping'
import type { DatabaseTransaction } from './user-lock'

// The named steps of `DrizzleRoomMemberRepository.joinOpenRoom`. Each step takes the
// transaction handle, so every statement of a join shares one pool connection.

type JoinedOutcome = Extract<JoinOpenRoomOutcome, { readonly status: 'joined' }>
type ReadyNotificationsBuilder = NonNullable<JoinOpenRoomInput['buildReadyNotifications']>
type DepartureNotificationsBuilder = NonNullable<JoinOpenRoomInput['buildDepartureNotifications']>

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
    departures: fields.departures,
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
  input: {
    // The locked row is validated without reading its Game: the summary belongs
    // to the read projections, and the join already loaded it through `findByCode`.
    readonly room: Pick<Room, 'id' | 'hostId' | 'maxPlayers' | 'readyAt' | 'lastActivityAt'>
    readonly userId: string
    readonly now: Date
  }
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
        departures: [],
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
 * Record step: writes the Squad Record of the Squad this join made Ready, with its roster as
 * it stands under the locks, in the join transaction. The record is keyed by `room_id`, so a
 * repeat writes nothing: the members are written only when this call created the record.
 * A failure rolls the whole join back, like the notifications.
 */
export async function recordCompletedSquad(
  tx: DatabaseTransaction,
  input: {
    readonly room: Pick<Room, 'id' | 'gameId' | 'name' | 'platform' | 'hostId' | 'maxPlayers'>
    readonly roster: Roster
    readonly readyAt: Date
  }
): Promise<void> {
  const { room, roster, readyAt } = input
  const [record] = await tx
    .insert(squadRecords)
    .values({
      roomId: room.id,
      gameId: room.gameId,
      name: room.name,
      platform: room.platform,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      readyAt,
    })
    .onConflictDoNothing({ target: squadRecords.roomId })
    .returning({ id: squadRecords.id })
  if (!record || roster.members.length === 0) return

  await tx.insert(squadRecordMembers).values(
    roster.members.map((member) => ({
      recordId: record.id,
      userId: member.userId,
      joinedAt: member.joinedAt,
    }))
  )
}

/**
 * Emit step: persists, in the join transaction, one `room_ready` notification per roster
 * member and what the Squad Release did to the other Squads, so a failure here rolls the
 * readiness, the Memberships and the release back too. The builders are pure and the roster
 * reads use the same connection, so the lock never waits for a second pool connection.
 * Only `room_ready` has an idempotency key; the other types are born once, here.
 */
export async function emitNotifications(
  tx: DatabaseTransaction,
  input: {
    readonly roster: Roster
    readonly departures: readonly SquadDeparture[]
    readonly buildReadyNotifications?: ReadyNotificationsBuilder
    readonly buildDepartureNotifications?: DepartureNotificationsBuilder
  }
): Promise<UserNotification[]> {
  const { roster } = input
  const readyInputs =
    input.buildReadyNotifications?.(roster.members, roster.users, input.departures) ?? []
  const departureInputs = input.buildDepartureNotifications?.(input.departures, roster.users) ?? []

  const ready =
    readyInputs.length === 0
      ? []
      : await tx
          .insert(userNotifications)
          .values(readyInputs.map(notificationInputToRow))
          .onConflictDoNothing({
            target: [userNotifications.roomId, userNotifications.userId, userNotifications.type],
            where: roomReadyOnly(userNotifications.type),
          })
          .returning()
  const departed =
    departureInputs.length === 0
      ? []
      : await tx
          .insert(userNotifications)
          .values(departureInputs.map(notificationInputToRow))
          .returning()
  return [...ready, ...departed].map(mapUserNotificationRow)
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

/** Members and profiles of a Room as they stand under the join's locks, not as they were before. */
export interface Roster {
  readonly members: RoomMember[]
  readonly users: { id: string; name: string; avatarUrl: string | null }[]
}

export async function loadRoster(tx: DatabaseTransaction, roomId: string): Promise<Roster> {
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
