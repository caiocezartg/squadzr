import { roomLanguageSchema } from '@squadzr/schemas'
import type { GameSummary } from '@domain/entities/game.entity'
import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { RoomRow } from '@infrastructure/database/schema/rooms'
import type { RoomMemberRow } from '@infrastructure/database/schema/room-members'

// A stored language outside the contract reads as pt-br instead of failing the row.
const languageSchema = roomLanguageSchema.catch('pt-br')

/** A Squad without its Game: the inserted row never reads the Game back. */
export type CreatedRoomEntity = Omit<Room, 'game'>

/** Single mapping seam for room rows, shared by the room and member repositories. */
function mapRoomColumns(row: RoomRow): CreatedRoomEntity {
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

/** Maps a row read with its Game joined in the same query. */
export function mapRoomRowToEntity(row: RoomRow, game: GameSummary): Room {
  return { ...mapRoomColumns(row), game }
}

/** Maps an inserted row, whose Game the create use case supplies. */
export function mapCreatedRoomRowToEntity(row: RoomRow): CreatedRoomEntity {
  return mapRoomColumns(row)
}

export function mapRoomMemberRowToEntity(row: RoomMemberRow): RoomMember {
  return {
    id: row.id,
    roomId: row.roomId,
    userId: row.userId,
    joinedAt: row.joinedAt,
  }
}
