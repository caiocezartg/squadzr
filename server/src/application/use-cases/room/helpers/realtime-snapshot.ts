import type { Room } from '@domain/entities/room.entity'
import { roomExpiresAt } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'
import type { RoomPlayer } from '@application/use-cases/room/get-room-by-code.use-case'

export interface RealtimeSnapshot {
  readonly room: Room
  readonly players: RoomPlayer[]
  readonly expiresAt: Date
}

export function buildRealtimeSnapshot(room: Room, players: RoomPlayer[]): RealtimeSnapshot {
  return { room, players, expiresAt: roomExpiresAt(room, ROOM) }
}
