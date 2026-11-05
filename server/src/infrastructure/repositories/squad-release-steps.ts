import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import {
  hostCandidateIds,
  planSquadRelease,
  type AffectedSquad,
  type PlannedDeparture,
  type SquadDeparture,
} from '@domain/services/squad-release'
import { user } from '@infrastructure/database/schema/auth'
import { games } from '@infrastructure/database/schema/games'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { rooms, type RoomRow } from '@infrastructure/database/schema/rooms'
import { validOpenRoomCondition } from './open-room-rules'
import type { DatabaseTransaction } from './user-lock'

// The Squad Release of a join that made a Squad Ready, in the order its locks are taken:
// the other Open Squads in ascending `id`, then the people who might inherit one, also in
// ascending `id`. The decisions are the pure `planSquadRelease`; this module only reads
// under lock and writes.

interface ReleaseInput {
  /** The Squad that just became Ready. */
  readonly roomId: string
  /** Its members: they leave every other valid Open Squad. */
  readonly memberIds: readonly string[]
  readonly now: Date
}

/** Removes every member of the Ready Squad from their other valid Open Squads. */
export async function releaseMembersFromOtherOpenRooms(
  tx: DatabaseTransaction,
  input: ReleaseInput
): Promise<SquadDeparture[]> {
  const released = new Set(input.memberIds)
  const candidateRoomIds = await findOtherOpenRoomIds(tx, input)
  if (candidateRoomIds.length === 0) return []

  // Memberships change only under their room's lock, so the locked rooms are re-read:
  // a room can have become Ready, expired or lost the member since the first read.
  const lockedRooms = await lockOpenRooms(tx, candidateRoomIds, input.now)
  const squads = (await loadSquads(tx, lockedRooms)).filter((squad) =>
    squad.members.some((member) => released.has(member.userId))
  )
  if (squads.length === 0) return []

  const hostingUserIds = await lockAndReadHosts(tx, squads, released, input.now)
  const plan = planSquadRelease({ releasedUserIds: released, squads, hostingUserIds })

  for (const departure of plan) await applyDeparture(tx, departure, input.now)

  const roomsById = new Map(lockedRooms.map((room) => [room.id, room]))
  const gamesById = await loadGameSummaries(tx, lockedRooms)
  return plan.map((departure) => describeDeparture(departure, roomsById, gamesById))
}

/** Valid Open Squads other than the Ready one that hold a Membership of its members. */
async function findOtherOpenRoomIds(tx: DatabaseTransaction, input: ReleaseInput) {
  const rows = await tx
    .selectDistinct({ roomId: roomMembers.roomId })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .where(
      and(
        inArray(roomMembers.userId, [...input.memberIds]),
        ne(roomMembers.roomId, input.roomId),
        validOpenRoomCondition(input.now)
      )
    )
  return rows.map((row) => row.roomId)
}

/** `FOR UPDATE` in ascending `id`, keeping only the rooms that are still valid Open Rooms. */
async function lockOpenRooms(
  tx: DatabaseTransaction,
  roomIds: readonly string[],
  now: Date
): Promise<RoomRow[]> {
  return tx
    .select()
    .from(rooms)
    .where(and(inArray(rooms.id, [...roomIds]), validOpenRoomCondition(now)))
    .orderBy(asc(rooms.id))
    .for('update')
}

async function loadSquads(
  tx: DatabaseTransaction,
  lockedRooms: readonly RoomRow[]
): Promise<AffectedSquad[]> {
  if (lockedRooms.length === 0) return []
  const memberRows = await tx
    .select()
    .from(roomMembers)
    .where(
      inArray(
        roomMembers.roomId,
        lockedRooms.map((room) => room.id)
      )
    )
  return lockedRooms.map((room) => ({
    roomId: room.id,
    hostId: room.hostId,
    members: memberRows
      .filter((member) => member.roomId === room.id)
      .map((member) => ({ userId: member.userId, joinedAt: member.joinedAt })),
  }))
}

/**
 * Who already hosts a valid Open Squad, among the people who could inherit one. Their user
 * rows are locked first (ascending `id`), so a `create` by one of them either commits before
 * this read or waits until the release is over: nobody ends up hosting two Open Squads.
 */
async function lockAndReadHosts(
  tx: DatabaseTransaction,
  squads: readonly AffectedSquad[],
  released: ReadonlySet<string>,
  now: Date
): Promise<Set<string>> {
  const candidates = hostCandidateIds(squads, released)
  if (candidates.length === 0) return new Set()

  await tx
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.id, candidates))
    .orderBy(asc(user.id))
    .for('no key update')

  const hostRows = await tx
    .selectDistinct({ hostId: rooms.hostId })
    .from(rooms)
    .where(and(inArray(rooms.hostId, candidates), validOpenRoomCondition(now)))
  return new Set(hostRows.map((row) => row.hostId))
}

/**
 * An emptied Squad, or one left with nobody who can host, goes away and its Memberships
 * with it. Any other keeps living: the leavers' Memberships go, the host changes if the plan
 * says so, and the Squad Activity advances as in a leave.
 */
async function applyDeparture(
  tx: DatabaseTransaction,
  departure: PlannedDeparture,
  now: Date
): Promise<void> {
  if (departure.outcome !== 'updated') {
    await tx.delete(rooms).where(eq(rooms.id, departure.roomId))
    return
  }

  await tx
    .delete(roomMembers)
    .where(
      and(
        eq(roomMembers.roomId, departure.roomId),
        inArray(roomMembers.userId, [...departure.removedUserIds])
      )
    )
  await tx
    .update(rooms)
    .set({
      lastActivityAt: now,
      updatedAt: now,
      ...(departure.newHostId === null ? {} : { hostId: departure.newHostId }),
    })
    .where(eq(rooms.id, departure.roomId))
}

interface GameSummaryRow {
  readonly name: string
  readonly coverUrl: string
}

async function loadGameSummaries(
  tx: DatabaseTransaction,
  lockedRooms: readonly RoomRow[]
): Promise<Map<string, GameSummaryRow>> {
  const rows = await tx
    .select({ id: games.id, name: games.name, coverUrl: games.coverUrl })
    .from(games)
    .where(inArray(games.id, [...new Set(lockedRooms.map((room) => room.gameId))]))
  return new Map(rows.map((row) => [row.id, { name: row.name, coverUrl: row.coverUrl }]))
}

function describeDeparture(
  departure: PlannedDeparture,
  roomsById: ReadonlyMap<string, RoomRow>,
  gamesById: ReadonlyMap<string, GameSummaryRow>
): SquadDeparture {
  const room = roomsById.get(departure.roomId)
  if (!room) throw new Error('Failed to load a Squad the release changed')
  const game = gamesById.get(room.gameId)
  return {
    ...departure,
    roomCode: room.code,
    roomName: room.name,
    gameName: game?.name ?? 'Unknown game',
    ...(game?.coverUrl ? { gameCoverUrl: game.coverUrl } : {}),
  }
}
