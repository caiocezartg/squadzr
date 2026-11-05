import type {
  CreateUserNotificationInput,
  UserNotification,
} from '@domain/entities/user-notification.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { User } from '@domain/entities/user.entity'
import type { SquadDeparture } from '@domain/services/squad-release'

type NotificationUsers = readonly Pick<User, 'id' | 'name' | 'avatarUrl'>[]

export interface JoinOpenRoomInput {
  readonly roomId: string
  readonly userId: string
  /**
   * Pure builder called with the authoritative members and player profiles read
   * through the join transaction, after the room lock, and with the Squads the
   * Squad Release took each member out of. It must not perform I/O or acquire
   * another pool connection while the transaction holds the lock. A failure to
   * persist notifications rolls the whole Membership change back.
   */
  readonly buildReadyNotifications?: (
    members: readonly RoomMember[],
    users: NotificationUsers,
    departures: readonly SquadDeparture[]
  ) => readonly CreateUserNotificationInput[]
  /**
   * Pure builder, under the same rules, for what the Squad Release did to the
   * other Squads. `users` are the profiles of the Squad that became Ready, which
   * is everyone a departure notification talks about.
   */
  readonly buildDepartureNotifications?: (
    departures: readonly SquadDeparture[],
    users: NotificationUsers
  ) => readonly CreateUserNotificationInput[]
}

export type JoinOpenRoomOutcome =
  | {
      readonly status: 'joined'
      readonly member: RoomMember
      readonly memberCount: number
      readonly becameReady: boolean
      /** Notifications actually inserted by this join, for the post-commit push. */
      readonly notifications: readonly UserNotification[]
      /** What the Squad Release did to each other Open Squad; empty unless this join made the Squad Ready. */
      readonly departures: readonly SquadDeparture[]
    }
  | { readonly status: 'ready' }
  | { readonly status: 'full'; readonly memberCount: number }
  | { readonly status: 'limit_reached' }
  | { readonly status: 'expired' }
  | { readonly status: 'not_found' }

export interface LeaveOpenRoomInput {
  readonly roomId: string
  readonly userId: string
}

export type LeaveOpenRoomOutcome =
  | { readonly status: 'left'; readonly wasHost: boolean; readonly memberCount: number }
  | { readonly status: 'ready' }
  | { readonly status: 'not_member' }
  | { readonly status: 'not_found' }

export interface IRoomMemberRepository {
  findByRoomId(roomId: string): Promise<RoomMember[]>
  findByUserId(userId: string): Promise<RoomMember[]>
  findByRoomAndUser(roomId: string, userId: string): Promise<RoomMember | null>
  countByRoomId(roomId: string): Promise<number>
  /**
   * Atomic join: locks the room row, verifies existence, expiration, readiness
   * and capacity, inserts the Membership, advances Room Activity and, when the
   * last seat is taken, sets readiness, runs the Squad Release (every member
   * leaves their other valid Open Squads, which hand their host over, close or
   * are deleted) and persists every notification in the same transaction. The
   * lifecycle instant is read from the injected clock only after both room and
   * user locks are held, so lock waits cannot leave expiration checks or
   * lifecycle timestamps stale. A transaction PostgreSQL aborts for a deadlock
   * between crossed Squad Releases runs again, three attempts in all.
   *
   * The per-user limit of valid Open Room Memberships is decided in the same
   * transaction: after the room row, the user row is locked, then the count and
   * the insert happen under that lock. Concurrent joins by one user into
   * different rooms therefore serialize on the user lock, and the limit cannot
   * be exceeded. The lock order is documented in `user-lock.ts`; the user lock
   * must allow KEY SHARE from foreign keys, including notifications to other
   * users in crossed final joins.
   */
  joinOpenRoom(input: JoinOpenRoomInput): Promise<JoinOpenRoomOutcome>
  /**
   * Atomic leave: locks the room, rejects readiness, removes the Membership (or
   * deletes the room and its memberships when the host leaves) and advances Room
   * Activity in the same transaction, reading the clock after the room lock.
   */
  leaveOpenRoom(input: LeaveOpenRoomInput): Promise<LeaveOpenRoomOutcome>
}
