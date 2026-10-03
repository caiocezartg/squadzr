import { randomInt } from 'node:crypto'
import { and, eq, count, desc, gte, isNull, lte, ne, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { z } from 'zod'
import type { CreateRoomInput, Room, UpdateRoomInput } from '@domain/entities/room.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { Database } from '@infrastructure/database/drizzle'
import { rooms, type RoomRow } from '@infrastructure/database/schema/rooms'
import { roomMembers } from '@infrastructure/database/schema/room-members'
import { ROOM } from '@config/constants'

const languageSchema = z.enum(['en', 'pt-br']).catch('pt-br')

export function activeRoomCondition() {
  return isNull(rooms.readyAt)
}

export function activeRoomWithGraceCondition(graceMs: number) {
  return or(isNull(rooms.readyAt), gte(rooms.readyAt, new Date(Date.now() - graceMs)))
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
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  )
}

type MyRoomRow = RoomRow & { memberCount: number }

function mapMyRoomRow(r: MyRoomRow): Room {
  const { memberCount, ...roomRow } = r
  return {
    ...mapRowToEntity(roomRow),
    memberCount,
    isMember: true as const,
  }
}

function mapRowToEntity(row: RoomRow): Room {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    hostId: row.hostId,
    gameId: row.gameId,
    maxPlayers: row.maxPlayers,
    discordLink: row.discordLink,
    tags: row.tags,
    language: languageSchema.parse(row.language),
    readyAt: row.readyAt,
    lastActivityAt: row.lastActivityAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class DrizzleRoomRepository implements IRoomRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<Room | null> {
    const result = await this.db.select().from(rooms).where(eq(rooms.id, id)).limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async findByCode(code: string): Promise<Room | null> {
    const result = await this.db.select().from(rooms).where(eq(rooms.code, code)).limit(1)
    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async findByHostId(hostId: string): Promise<Room[]> {
    const result = await this.db.select().from(rooms).where(eq(rooms.hostId, hostId))
    return result.map(mapRowToEntity)
  }

  async findAll(): Promise<Room[]> {
    const result = await this.db.select().from(rooms)
    return result.map(mapRowToEntity)
  }

  async findAvailable(): Promise<Room[]> {
    const result = await this.db
      .select({
        room: rooms,
        memberCount: count(roomMembers.id),
      })
      .from(rooms)
      .leftJoin(roomMembers, eq(rooms.id, roomMembers.roomId))
      .where(activeRoomWithGraceCondition(ROOM.GRACE_WINDOW_MS))
      .groupBy(rooms.id)

    return result.map((row) => ({
      ...mapRowToEntity(row.room),
      memberCount: row.memberCount,
    }))
  }

  async countActiveByHostId(hostId: string): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(rooms)
      // Note: unlike findAvailable(), no grace window — a room with readyAt set is done.
      .where(and(eq(rooms.hostId, hostId), activeRoomCondition()))
    return result[0]?.count ?? 0
  }

  async findMyRooms(userId: string): Promise<{ hosted: Room[]; joined: Room[] }> {
    const allMembersAlias = alias(roomMembers, 'all_members')
    const userMembershipAlias = alias(roomMembers, 'user_membership')

    // Note: unlike findAvailable(), we use strict isNull(readyAt) here with no grace window.
    // My Rooms shows only genuinely open rooms (not ones in the 5-min deletion window).
    const activeCondition = activeRoomCondition()

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

    const [hostedRows, joinedRows] = await Promise.all([
      this.db
        .select(selectFields)
        .from(rooms)
        .leftJoin(allMembersAlias, eq(allMembersAlias.roomId, rooms.id))
        .where(and(eq(rooms.hostId, userId), activeCondition))
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
        .where(and(ne(rooms.hostId, userId), activeCondition))
        .groupBy(rooms.id)
        .orderBy(desc(rooms.createdAt)),
    ])

    return {
      hosted: hostedRows.map((r) => mapMyRoomRow(r as MyRoomRow)),
      joined: joinedRows.map((r) => mapMyRoomRow(r as MyRoomRow)),
    }
  }

  async findExpiredRooms(beforeDate: Date): Promise<Room[]> {
    const result = await this.db.select().from(rooms).where(lte(rooms.readyAt, beforeDate))

    return result.map(mapRowToEntity)
  }

  async create(input: CreateRoomInput): Promise<Room> {
    const MAX_ATTEMPTS = 5
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.db
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
          })
          .returning()

        const row = result[0]
        if (!row) throw new Error('Failed to create room')
        return mapRowToEntity(row)
      } catch (error) {
        if (attempt < MAX_ATTEMPTS - 1 && isUniqueConstraintViolation(error)) continue
        throw error
      }
    }
    throw new Error('Failed to generate a unique room code after 5 attempts')
  }

  async update(id: string, input: UpdateRoomInput): Promise<Room | null> {
    const updateData: Partial<{
      name: string
      maxPlayers: number
      discordLink: string
      tags: string[]
      language: string
      readyAt: Date
      updatedAt: Date
    }> = {
      updatedAt: new Date(),
    }

    if (input.name !== undefined) {
      updateData.name = input.name
    }
    if (input.maxPlayers !== undefined) {
      updateData.maxPlayers = input.maxPlayers
    }
    if (input.discordLink !== undefined) {
      updateData.discordLink = input.discordLink
    }
    if (input.tags !== undefined) {
      updateData.tags = input.tags
    }
    if (input.language !== undefined) {
      updateData.language = input.language
    }
    if (input.readyAt !== undefined) {
      updateData.readyAt = input.readyAt
    }

    const result = await this.db.update(rooms).set(updateData).where(eq(rooms.id, id)).returning()

    const row = result[0]
    return row ? mapRowToEntity(row) : null
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.delete(rooms).where(eq(rooms.id, id)).returning({ id: rooms.id })
    return result.length > 0
  }
}
