import { and, count, eq } from 'drizzle-orm'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type {
  IRoomMemberRepository,
  JoinOpenRoomInput,
  JoinOpenRoomOutcome,
  LeaveOpenRoomInput,
  LeaveOpenRoomOutcome,
} from '@domain/repositories/room-member.repository'
import type { Database } from '@infrastructure/database/drizzle'
import type { Clock } from '@domain/services/clock.interface'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { rooms } from '@infrastructure/database/schema/rooms'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { mapCreatedRoomRowToEntity, mapRoomMemberRowToEntity } from './room-mapping'
import { lockUserRow } from './user-lock'
import {
  advanceRoomActivity,
  emitNotifications,
  insertMembership,
  joinedOutcome,
  loadRoster,
  lockRoomRow,
  validateJoin,
} from './room-join-steps'
import { releaseMembersFromOtherOpenRooms } from './squad-release-steps'

/** A join PostgreSQL aborts for a deadlock runs again, this many attempts in all. */
const JOIN_MAX_ATTEMPTS = 3
const DEADLOCK_DETECTED = '40P01'

function isDeadlock(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: unknown; cause?: unknown }
  return candidate.code === DEADLOCK_DETECTED || isDeadlock(candidate.cause)
}

export class DrizzleRoomMemberRepository implements IRoomMemberRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  async findByRoomId(roomId: string): Promise<RoomMember[]> {
    const result = await this.db.select().from(roomMembers).where(eq(roomMembers.roomId, roomId))
    return result.map(mapRoomMemberRowToEntity)
  }

  async findByUserId(userId: string): Promise<RoomMember[]> {
    const result = await this.db.select().from(roomMembers).where(eq(roomMembers.userId, userId))
    return result.map(mapRoomMemberRowToEntity)
  }

  async findByRoomAndUser(roomId: string, userId: string): Promise<RoomMember | null> {
    const result = await this.db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
      .limit(1)
    const row = result[0]
    return row ? mapRoomMemberRowToEntity(row) : null
  }

  async countByRoomId(roomId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId))
    return result[0]?.count ?? 0
  }

  async joinOpenRoom(input: JoinOpenRoomInput): Promise<JoinOpenRoomOutcome> {
    // Two Squads that become Ready at once with a member in common each lock the other
    // in the Squad Release. PostgreSQL aborts one of them; it runs again from the start,
    // where the winner has already taken the shared member out of its Squad.
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.joinOpenRoomOnce(input)
      } catch (error) {
        if (attempt >= JOIN_MAX_ATTEMPTS || !isDeadlock(error)) throw error
      }
    }
  }

  private joinOpenRoomOnce(input: JoinOpenRoomInput): Promise<JoinOpenRoomOutcome> {
    return this.db.transaction(async (tx) => {
      // Lock: the room row first, which serializes joins and leaves on this Room, then
      // the joining user's row, which serializes the per-user limits. Both waits end
      // before the clock is read, so expiration and every lifecycle timestamp are current.
      const roomRow = await lockRoomRow(tx, input.roomId)
      if (!roomRow) return { status: 'not_found' }
      await lockUserRow(tx, input.userId)
      const now = this.clock.now()
      const room = mapCreatedRoomRowToEntity(roomRow)

      // Validate: every answer that writes no Membership returns here.
      const validation = await validateJoin(tx, { room, userId: input.userId, now })
      if (!validation.admitted) return validation.outcome

      // Insert Membership. A concurrent duplicate of it is answered without a seat.
      const insertion = await insertMembership(tx, {
        roomId: room.id,
        userId: input.userId,
        joinedAt: now,
      })
      if (!insertion.created) {
        return joinedOutcome({
          member: insertion.member,
          memberCount: validation.currentCount,
          becameReady: false,
          notifications: [],
          departures: [],
        })
      }

      const memberCount = validation.currentCount + 1
      const becameReady = memberCount >= room.maxPlayers
      await advanceRoomActivity(tx, { roomId: room.id, now, becameReady })

      if (!becameReady) {
        return joinedOutcome({
          member: insertion.member,
          memberCount,
          becameReady,
          notifications: [],
          departures: [],
        })
      }

      // Squad Release: the join that takes the last seat takes every member out of their
      // other Open Squads, then emits the notifications. Both are in this transaction.
      const roster = await loadRoster(tx, room.id)
      const departures = await releaseMembersFromOtherOpenRooms(tx, {
        roomId: room.id,
        memberIds: roster.members.map((member) => member.userId),
        now,
      })
      const notifications = await emitNotifications(tx, {
        roster,
        departures,
        ...(input.buildReadyNotifications
          ? { buildReadyNotifications: input.buildReadyNotifications }
          : {}),
        ...(input.buildDepartureNotifications
          ? { buildDepartureNotifications: input.buildDepartureNotifications }
          : {}),
      })

      return joinedOutcome({
        member: insertion.member,
        memberCount,
        becameReady,
        notifications,
        departures,
      })
    })
  }

  async leaveOpenRoom(input: LeaveOpenRoomInput): Promise<LeaveOpenRoomOutcome> {
    return this.db.transaction(async (tx) => {
      // Locking the room serializes the leave against a concurrent final join:
      // either this leave wins (the seat reopens) or readiness does.
      const roomRows = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, input.roomId))
        .limit(1)
        .for('update')

      const roomRow = roomRows[0]
      if (!roomRow) return { status: 'not_found' }

      const room = mapCreatedRoomRowToEntity(roomRow)
      const now = this.clock.now()
      if (isRoomExpired(room, now, ROOM)) return { status: 'not_found' }
      if (room.readyAt) return { status: 'ready' }

      const membershipRows = await tx
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, input.roomId), eq(roomMembers.userId, input.userId)))
        .limit(1)

      if (membershipRows.length === 0) return { status: 'not_member' }

      if (room.hostId === input.userId) {
        // Memberships cascade with the room in the same statement.
        await tx.delete(rooms).where(eq(rooms.id, input.roomId))
        return { status: 'left', wasHost: true, memberCount: 0 }
      }

      await tx
        .delete(roomMembers)
        .where(and(eq(roomMembers.roomId, input.roomId), eq(roomMembers.userId, input.userId)))

      await tx
        .update(rooms)
        .set({ lastActivityAt: now, updatedAt: now })
        .where(eq(rooms.id, input.roomId))

      const remainingRows = await tx
        .select({ currentCount: count() })
        .from(roomMembers)
        .where(eq(roomMembers.roomId, input.roomId))

      return {
        status: 'left',
        wasHost: false,
        memberCount: remainingRows[0]?.currentCount ?? 0,
      }
    })
  }
}
