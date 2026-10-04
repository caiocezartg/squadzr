import type { CreateRoomInput, Room, UpdateRoomInput } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'

/** Room and its host Membership, created together in one transaction. */
export interface CreatedRoom {
  readonly room: Room
  readonly hostMember: RoomMember
}

export type CreateRoomOutcome =
  | ({ readonly status: 'created' } & CreatedRoom)
  | { readonly status: 'limit_reached' }

export interface IRoomRepository {
  findById(id: string): Promise<Room | null>
  findByCode(code: string): Promise<Room | null>
  findByIds(ids: readonly string[]): Promise<Room[]>
  findByHostId(hostId: string): Promise<Room[]>
  findAll(): Promise<Room[]>
  /** Open Rooms whose Room Activity is still inside the 24h window, with memberCount. */
  findAvailable(now: Date): Promise<Room[]>
  /** Open Rooms inside the activity window plus Ready Rooms inside their 60min retention. */
  findMyRooms(userId: string, now: Date): Promise<{ hosted: Room[]; joined: Room[] }>
  /**
   * Creates the room and its host Membership in one transaction, stamping Room
   * Activity with the injected clock, read once after the user row lock. The
   * same instant is used for the host-limit cutoff and all creation timestamps.
   * The per-host limit of valid Open Rooms is decided in that same transaction:
   * the user row is locked first, then the count and insert happen under that
   * lock, so concurrent creations by one host cannot
   * both pass the limit. A creation inserts a brand-new room row and never
   * locks an existing one, so this user-first path cannot cycle with the
   * room-then-user order of `joinOpenRoom`.
   */
  create(input: CreateRoomInput): Promise<CreateRoomOutcome>
  /** Rooms whose activity/retention window ended at or before `now`. */
  findExpiredRooms(now: Date): Promise<Room[]>
  /** Deletes the room only if it is still expired at `now`; memberships cascade. */
  deleteExpired(id: string, now: Date): Promise<boolean>
  update(id: string, input: UpdateRoomInput, now: Date): Promise<Room | null>
  delete(id: string): Promise<boolean>
}
