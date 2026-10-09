import { randomInt } from 'node:crypto'
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lte, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import type { CreateRoomInput, Room } from '@domain/entities/room.entity'
import type { CreateRoomOutcome, IRoomRepository } from '@domain/repositories/room.repository'
import type { Clock } from '@domain/services/clock.interface'
import type { Database } from '@infrastructure/database/drizzle'
import { rooms, type RoomRow } from '@infrastructure/database/schema/rooms'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { ROOM } from '@config/constants'
import { mapRoomMemberRowToEntity, mapRoomRowToEntity } from './room-mapping'
import { lockUserRow } from './user-lock'

function openRoomCutoff(now: Date): Date {
  return new Date(now.getTime() - ROOM.OPEN_ROOM_TTL_MS)
}

function readyRoomCutoff(now: Date): Date {
  return new Date(now.getTime() - ROOM.READY_ROOM_RETENTION_MS)
}

/** Open Rooms whose Room Activity is still inside the 24h window. */
export function validOpenRoomCondition(now: Date) {
  return and(isNull(rooms.readyAt), gt(rooms.lastActivityAt, openRoomCutoff(now)))
}

/** Valid Open Rooms plus Ready Rooms still inside their 60min retention. */
function retainedRoomCondition(now: Date) {
  return or(
    validOpenRoomCondition(now),
    and(isNotNull(rooms.readyAt), gt(rooms.readyAt, readyRoomCutoff(now)))
  )
}

/** Rooms whose activity/retention window ended at or before `now`. */
export function expiredRoomCondition(now: Date) {
  return or(
    and(isNotNull(rooms.readyAt), lte(rooms.readyAt, readyRoomCutoff(now))),
    and(isNull(rooms.readyAt), lte(rooms.lastActivityAt, openRoomCutoff(now)))
  )
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < ROOM.CODE_LENGTH; i++) {
    code += chars.charAt(randomInt(chars.length))
  }
  return code
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const candidate = error as { code?: string; cause?: unknown }
  return candidate.code === '23505' || isUniqueConstraintViolation(candidate.cause)
}

type MyRoomRow = RoomRow & { memberCount: number }

function mapMyRoomRow(r: MyRoomRow): Room {
  const { memberCount, ...roomRow } = r
  return {
    ...mapRoomRowToEntity(roomRow),
    memberCount,
    isMember: true as const,
  }
}

export class DrizzleRoomRepository implements IRoomRepository {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock
  ) {}

  async findByCode(code: string): Promise<Room | null> {
    const result = await this.db.select().from(rooms).where(eq(rooms.code, code)).limit(1)
    const row = result[0]
    return row ? mapRoomRowToEntity(row) : null
  }

  async findByIds(ids: readonly string[]): Promise<Room[]> {
    if (ids.length === 0) return []
    const result = await this.db
      .select()
      .from(rooms)
      .where(inArray(rooms.id, [...ids]))
    return result.map(mapRoomRowToEntity)
  }

  async findAvailable(now: Date): Promise<Room[]> {
    const result = await this.db
      .select({
        room: rooms,
        memberCount: count(roomMembers.id),
      })
      .from(rooms)
      .leftJoin(roomMembers, eq(rooms.id, roomMembers.roomId))
      .where(validOpenRoomCondition(now))
      .groupBy(rooms.id)

    return result.map((row) => ({
      ...mapRoomRowToEntity(row.room),
      memberCount: row.memberCount,
    }))
  }

  async findMyRooms(userId: string, now: Date): Promise<{ hosted: Room[]; joined: Room[] }> {
    const allMembersAlias = alias(roomMembers, 'all_members')
    const userMembershipAlias = alias(roomMembers, 'user_membership')

    const selectFields = {
      id: rooms.id,
      code: rooms.code,
      name: rooms.name,
      hostId: rooms.hostId,
      gameId: rooms.gameId,
      maxPlayers: rooms.maxPlayers,
      discordLink: rooms.discordLink,
      readyAt: rooms.readyAt,
      lastActivityAt: rooms.lastActivityAt,
      tags: rooms.tags,
      language: rooms.language,
      createdAt: rooms.createdAt,
      updatedAt: rooms.updatedAt,
      memberCount: count(allMembersAlias.id),
    }

    const condition = retainedRoomCondition(now)

    const [hostedRows, joinedRows] = await Promise.all([
      this.db
        .select(selectFields)
        .from(rooms)
        .leftJoin(allMembersAlias, eq(allMembersAlias.roomId, rooms.id))
        .where(and(eq(rooms.hostId, userId), condition))
        .groupBy(rooms.id)
        .orderBy(desc(rooms.createdAt)),
      this.db
        .select(selectFields)
        .from(rooms)
        .innerJoin(
          userMembershipAlias,
          and(eq(userMembershipAlias.roomId, rooms.id), eq(userMembershipAlias.userId, userId))
        )
        .leftJoin(allMembersAlias, eq(allMembersAlias.roomId, rooms.id))
        .where(and(ne(rooms.hostId, userId), condition))
        .groupBy(rooms.id)
        .orderBy(desc(rooms.createdAt)),
    ])

    return {
      hosted: hostedRows.map((r) => mapMyRoomRow(r as MyRoomRow)),
      joined: joinedRows.map((r) => mapMyRoomRow(r as MyRoomRow)),
    }
  }

  async findExpiredRooms(now: Date): Promise<Room[]> {
    const result = await this.db.select().from(rooms).where(expiredRoomCondition(now))

    return result.map(mapRoomRowToEntity)
  }

  async create(input: CreateRoomInput): Promise<CreateRoomOutcome> {
    const MAX_ATTEMPTS = 5
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await this.db.transaction(async (tx) => {
          // Per-host limit: the user row is locked before the count and the
          // insert, so two concurrent creations by one host cannot both read a
          // count below the limit. This path only inserts a brand-new room row
          // (never locks an existing one), so its user-first order cannot cycle
          // with the room-then-user order of `joinOpenRoom`; see `lockUserRow`.
          await lockUserRow(tx, input.hostId)

          // Read once after the lock wait: the host-limit cutoff, room and host
          // Membership all use the current instant, including on code retries.
          const now = this.clock.now()

          const hostedRows = await tx
            .select({ currentCount: count() })
            .from(rooms)
            .where(and(eq(rooms.hostId, input.hostId), validOpenRoomCondition(now)))
          const hostedCount = hostedRows[0]?.currentCount ?? 0
          if (hostedCount >= ROOM.CREATE_LIMIT) return { status: 'limit_reached' }

          const roomRows = await tx
            .insert(rooms)
            .values({
              code: generateRoomCode(),
              name: input.name,
              hostId: input.hostId,
              gameId: input.gameId,
              maxPlayers: input.maxPlayers,
              discordLink: input.discordLink ?? null,
              tags: input.tags ?? [],
              language: input.language ?? 'pt-br',
              lastActivityAt: now,
              createdAt: now,
              updatedAt: now,
            })
            .returning()

          const roomRow = roomRows[0]
          if (!roomRow) throw new Error('Failed to create room')

          const memberRows = await tx
            .insert(roomMembers)
            .values({
              roomId: roomRow.id,
              userId: input.hostId,
              joinedAt: now,
            })
            .returning()

          const memberRow = memberRows[0]
          if (!memberRow) throw new Error('Failed to create room host membership')

          return {
            status: 'created',
            room: mapRoomRowToEntity(roomRow),
            hostMember: mapRoomMemberRowToEntity(memberRow),
          }
        })
      } catch (error) {
        if (attempt < MAX_ATTEMPTS - 1 && isUniqueConstraintViolation(error)) continue
        throw error
      }
    }
    throw new Error('Failed to generate a unique room code after 5 attempts')
  }

  async deleteExpired(id: string, now: Date): Promise<boolean> {
    // Conditional delete: a concurrent join that advanced Room Activity after
    // the scheduler listed the room keeps it alive instead of losing the row.
    const result = await this.db
      .delete(rooms)
      .where(and(eq(rooms.id, id), expiredRoomCondition(now)))
      .returning({ id: rooms.id })
    return result.length > 0
  }
}
