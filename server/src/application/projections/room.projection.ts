import type { PublicRoomDto, RoomDto, RoomMemberDto } from '@squadzr/schemas'
import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'

/**
 * Public projection of a room, for the catalog and guest realtime events.
 * Fields are listed one by one so the Discord invite and any future private
 * field stay out unless they are added here on purpose.
 */
export function toPublicRoom(room: Room): PublicRoomDto {
  return {
    id: room.id,
    code: room.code,
    name: room.name,
    hostId: room.hostId,
    gameId: room.gameId,
    maxPlayers: room.maxPlayers,
    tags: room.tags,
    language: room.language,
    ...(room.memberCount !== undefined && { memberCount: room.memberCount }),
    ...(room.isMember !== undefined && { isMember: room.isMember }),
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  }
}

/** Private projection of a room: only for authenticated members of that room. */
export function toMemberRoom(room: Room): RoomDto {
  return {
    ...toPublicRoom(room),
    discordLink: room.discordLink,
  }
}

export function toRoomMemberDto(member: RoomMember): RoomMemberDto {
  return {
    id: member.id,
    roomId: member.roomId,
    userId: member.userId,
    joinedAt: member.joinedAt.toISOString(),
  }
}
