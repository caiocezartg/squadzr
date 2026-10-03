import type { CreateRoomMemberInput, RoomMember } from '@domain/entities/room-member.entity'

export interface IRoomMemberRepository {
  findByRoomId(roomId: string): Promise<RoomMember[]>
  findByUserId(userId: string): Promise<RoomMember[]>
  findByRoomAndUser(roomId: string, userId: string): Promise<RoomMember | null>
  create(input: CreateRoomMemberInput): Promise<RoomMember>
  delete(roomId: string, userId: string): Promise<boolean>
  deleteByRoomId(roomId: string): Promise<boolean>
  countByRoomId(roomId: string): Promise<number>
  /** Counts memberships where the room is still open (readyAt null). */
  countActiveByUserId(userId: string): Promise<number>
  /**
   * Atomically checks room capacity and inserts the member if space is available.
   * Uses a SELECT FOR UPDATE on the room row to prevent concurrent overfill.
   * Returns the new member or null if the room is at/over maxPlayers.
   */
  createIfCapacityAvailable(
    input: CreateRoomMemberInput,
    maxPlayers: number
  ): Promise<{ member: RoomMember | null; memberCount: number }>
}
