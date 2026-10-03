import { eq, and, count } from 'drizzle-orm'
import type { CreateRoomMemberInput, RoomMember } from '@domain/entities/room-member.entity'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { roomMembers, type RoomMemberRow } from '@infrastructure/database/schema/room-members'
import { rooms } from '@infrastructure/database/schema/rooms'
import { activeRoomCondition } from './drizzle-room.repository'

function mapRowToEntity(row: RoomMemberRow): RoomMember {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    joinedAt: row.joinedAt,
  }
}

export class DrizzleRoomMemberRepository implements IRoomMemberRepository {
  constructor(private readonly db: Database) {}

  async findByRoomId(roomId: string): Promise<RoomMember[]> {
    const result = await this.db.select().from(roomMembers).where(eq(roomMembers.roomId, roomId))
    return result.map(mapRowToEntity)
  }

  async findByUserId(userId: string): Promise<RoomMember[]> {
    const result = await this.db.select().from(roomMembers).where(eq(roomMembers.userId, userId))
    return result.map(mapRowToEntity)
  }

  async findByRoomAndUser(roomId: string, userId: string): Promise<RoomMember | null> {
    const result = await this.db
      .select()
      .from(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
      .limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async create(input: CreateRoomMemberInput): Promise<RoomMember> {
    const result = await this.db
      .insert(roomMembers)
      .values({
        roomId: input.roomId,
        userId: input.userId,
      })
      .returning()

    const row = result[0]
    if (!row) {
      throw new Error('Failed to create room member')
    }
    return mapRowToEntity(row)
  }

  async delete(roomId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
      .returning({ id: roomMembers.id })
    return result.length > 0
  }

  async deleteByRoomId(roomId: string): Promise<boolean> {
    const result = await this.db
      .delete(roomMembers)
      .where(eq(roomMembers.roomId, roomId))
      .returning({ id: roomMembers.id })
    return result.length > 0
  }

  async countByRoomId(roomId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId))
    return result[0]?.count ?? 0
  }

  async createIfCapacityAvailable(
    input: CreateRoomMemberInput,
    maxPlayers: number
  ): Promise<{ member: RoomMember | null; memberCount: number }> {
    return this.db.transaction(async (tx) => {
      // Lock the room row to serialize concurrent join attempts on the same room
      await tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, input.roomId)).for('update')

      const countResult = await tx
        .select({ currentCount: count() })
        .from(roomMembers)
        .where(eq(roomMembers.roomId, input.roomId))

      const currentCount = countResult[0]?.currentCount ?? 0

      if (currentCount >= maxPlayers) {
        return { member: null, memberCount: currentCount }
      }

      const result = await tx
        .insert(roomMembers)
        .values({ roomId: input.roomId, userId: input.userId })
        .returning()

      const row = result[0]
      if (!row) throw new Error('Failed to create room member')

      return { member: mapRowToEntity(row), memberCount: currentCount + 1 }
    })
  }

  async countActiveByUserId(userId: string): Promise<number> {
    // A ready room (readyAt set) is not genuinely active from the member's perspective.
    const result = await this.db
      .select({ count: count() })
      .from(roomMembers)
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .where(and(eq(roomMembers.userId, userId), activeRoomCondition()))
    return result[0]?.count ?? 0
  }
}
