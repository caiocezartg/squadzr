import { MEMBER_PREVIEW_LIMIT } from '@squadzr/schemas'
import type { Room } from '@domain/entities/room.entity'
import type { RoomPlayer } from '@application/use-cases/room/get-room-by-code.use-case'

/** The Squad with its member preview taken from the roster: its first five players. */
export function withRosterPreview(room: Room, players: readonly RoomPlayer[]): Room {
  return {
    ...room,
    memberPreview: players
      .slice(0, MEMBER_PREVIEW_LIMIT)
      .map(({ id, name, image }) => ({ id, name, image })),
  }
}
