import type { CreateRoomInput, Room, UpdateRoomInput } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'

/** Room and its host Membership, created together in one transaction. */
export interface CreatedRoom {
  readonly room: Room
  readonly hostMember: RoomMember
}

export interface IRoomRepository {
  findById(id: string): Promise<Room | null>
  findByCode(code: string): Promise<Room | null>
  findByIds(ids: readonly string[]): Promise<Room[]>
  findByHostId(hostId: string): Promise<Room[]>
  findAll(): Promise<Room[]>
  /** Open Rooms whose Room Activity is still inside the 24h window, with memberCount. */
  findAvailable(now: Date): Promise<Room[]>
  /** Valid Open Rooms only: Ready Rooms and expired Open Rooms never count. */
  countActiveByHostId(hostId: string, now: Date): Promise<number>
  /** Open Rooms inside the activity window plus Ready Rooms inside their 60min retention. */
  findMyRooms(userId: string, now: Date): Promise<{ hosted: Room[]; joined: Room[] }>
  /** Creates the room and its host Membership in one transaction, stamping Room Activity with `now`. */
  create(input: CreateRoomInput, now: Date): Promise<CreatedRoom>
  /** Rooms whose activity/retention window ended at or before `now`. */
  findExpiredRooms(now: Date): Promise<Room[]>
  /** Deletes the room only if it is still expired at `now`; memberships cascade. */
  deleteExpired(id: string, now: Date): Promise<boolean>
  update(id: string, input: UpdateRoomInput, now: Date): Promise<Room | null>
  delete(id: string): Promise<boolean>
}
