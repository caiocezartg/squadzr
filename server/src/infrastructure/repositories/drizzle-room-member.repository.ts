import { and, count, eq, gt, isNull } from 'drizzle-orm'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type {
  IRoomMemberRepository,
  JoinOpenRoomInput,
  JoinOpenRoomOutcome,
  LeaveOpenRoomInput,
  LeaveOpenRoomOutcome,
} from '@domain/repositories/room-member.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { rooms } from '@infrastructure/database/schema/rooms'
import { userNotifications } from '@infrastructure/database/schema/user-notifications'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import { mapRoomMemberRowToEntity, mapRoomRowToEntity } from './room-mapping'
import {
  mapUserNotificationRow,
  notificationInputToRow,
} from './drizzle-user-notification.repository'

function openRoomCutoff(now: Date): Date {
  return new Date(now.getTime() - ROOM.OPEN_ROOM_TTL_MS)
}

export class DrizzleRoomMemberRepository implements IRoomMemberRepository {
  constructor(private readonly db: Database) {}

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

  async countActiveByUserId(userId: string, now: Date): Promise<number> {
    // Only valid Open Rooms count: a Ready Room is done and an Open Room past
    // its activity window is gone even before the scheduler deletes it.
    const result = await this.db
      .select({ count: count() })
      .from(roomMembers)
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .where(
        and(
          eq(roomMembers.userId, userId),
          isNull(rooms.readyAt),
          gt(rooms.lastActivityAt, openRoomCutoff(now))
        )
      )
    return result[0]?.count ?? 0
  }

  async joinOpenRoom(input: JoinOpenRoomInput): Promise<JoinOpenRoomOutcome> {
    return this.db.transaction(async (tx) => {
      // Lock the room row: joins and leaves on the same room serialize here, so
      // capacity, readiness and Room Activity are decided from fresh state.
      const roomRows = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.id, input.roomId))
        .limit(1)
        .for('update')

      const roomRow = roomRows[0]
      if (!roomRow) return { status: 'not_found' }

      const room = mapRoomRowToEntity(roomRow)
      if (isRoomExpired(room, input.now, ROOM)) return { status: 'expired' }

      const countRows = await tx
        .select({ currentCount: count() })
        .from(roomMembers)
        .where(eq(roomMembers.roomId, input.roomId))
      const currentCount = countRows[0]?.currentCount ?? 0

      // Capacity is decided before readiness so the loser of a race for the
      // last seat keeps the established ROOM_FULL answer.
      if (currentCount >= room.maxPlayers) {
        return { status: 'full', memberCount: currentCount }
      }
      if (room.readyAt) return { status: 'ready' }

      const insertedRows = await tx
        .insert(roomMembers)
        .values({ roomId: input.roomId, userId: input.userId, joinedAt: input.now })
        .onConflictDoNothing({ target: [roomMembers.roomId, roomMembers.userId] })
        .returning()

      const inserted = insertedRows[0]
      if (!inserted) {
        // Concurrent duplicate of the same Membership: idempotent, no activity change.
        const existing = await tx
          .select()
          .from(roomMembers)
          .where(and(eq(roomMembers.roomId, input.roomId), eq(roomMembers.userId, input.userId)))
          .limit(1)
        const existingRow = existing[0]
        if (!existingRow) throw new Error('Failed to load the existing room membership')
        return {
          status: 'joined',
          member: mapRoomMemberRowToEntity(existingRow),
          memberCount: currentCount,
          becameReady: false,
          notifications: [],
        }
      }

      const memberCount = currentCount + 1
      const becameReady = memberCount >= room.maxPlayers

      await tx
        .update(rooms)
        .set({
          lastActivityAt: input.now,
          updatedAt: input.now,
          ...(becameReady && { readyAt: input.now }),
        })
        .where(eq(rooms.id, input.roomId))

      if (!becameReady || !input.buildReadyNotifications) {
        return {
          status: 'joined',
          member: mapRoomMemberRowToEntity(inserted),
          memberCount,
          becameReady,
          notifications: [],
        }
      }

      const memberRows = await tx
        .select()
        .from(roomMembers)
        .where(eq(roomMembers.roomId, input.roomId))
      const members = memberRows.map(mapRoomMemberRowToEntity)

      // Built from the authoritative member list inside the transaction and
      // persisted here: a failure rolls the readiness and the join back too.
      const inputs = input.buildReadyNotifications(members)
      if (inputs.length === 0) {
        return {
          status: 'joined',
          member: mapRoomMemberRowToEntity(inserted),
          memberCount,
          becameReady,
          notifications: [],
        }
      }

      const notificationRows = await tx
        .insert(userNotifications)
        .values(inputs.map(notificationInputToRow))
        .onConflictDoNothing({
          target: [userNotifications.roomId, userNotifications.userId, userNotifications.type],
        })
        .returning()

      return {
        status: 'joined',
        member: mapRoomMemberRowToEntity(inserted),
        memberCount,
        becameReady,
        notifications: notificationRows.map(mapUserNotificationRow),
      }
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

      const room = mapRoomRowToEntity(roomRow)
      if (isRoomExpired(room, input.now, ROOM)) return { status: 'not_found' }
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
        .set({ lastActivityAt: input.now, updatedAt: input.now })
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
