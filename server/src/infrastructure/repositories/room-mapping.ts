import { z } from 'zod'
import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { RoomRow } from '@infrastructure/database/schema/rooms'
import type { RoomMemberRow } from '@infrastructure/database/schema/room-members'

const languageSchema = z.enum(['en', 'pt-br']).catch('pt-br')

/** Single mapping seam for room rows, shared by the room and member repositories. */
export function mapRoomRowToEntity(row: RoomRow): Room {
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

export function mapRoomMemberRowToEntity(row: RoomMemberRow): RoomMember {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    joinedAt: row.joinedAt,
  }
}
