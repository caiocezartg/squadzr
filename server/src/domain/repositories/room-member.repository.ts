import type {
  CreateUserNotificationInput,
  UserNotification,
} from '@domain/entities/user-notification.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'

export interface JoinOpenRoomInput {
  readonly roomId: string
  readonly userId: string
  /** Single injected-clock instant shared by `joined_at`, `last_activity_at` and `ready_at`. */
  readonly now: Date
  /**
   * Builds the room_ready notifications from the authoritative member list once
   * this join fills the room. Called inside the join transaction, so a failure
   * to persist the notifications rolls the whole Membership change back.
   */
  readonly buildReadyNotifications?: (
    members: readonly RoomMember[]
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
    }
  | { readonly status: 'ready' }
  | { readonly status: 'full'; readonly memberCount: number }
  | { readonly status: 'expired' }
  | { readonly status: 'not_found' }

export interface LeaveOpenRoomInput {
  readonly roomId: string
  readonly userId: string
  readonly now: Date
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
  /** Valid Open Rooms only: Ready Rooms and expired Open Rooms never count. */
  countActiveByUserId(userId: string, now: Date): Promise<number>
  /**
   * Atomic join: locks the room, verifies existence, expiration, readiness and
   * capacity, inserts the Membership, advances Room Activity and, when the last
   * seat is taken, sets readiness and persists every member's `room_ready`
   * notification in the same transaction.
   */
  joinOpenRoom(input: JoinOpenRoomInput): Promise<JoinOpenRoomOutcome>
  /**
   * Atomic leave: locks the room, rejects readiness, removes the Membership (or
   * deletes the room and its memberships when the host leaves) and advances Room
   * Activity in the same transaction.
   */
  leaveOpenRoom(input: LeaveOpenRoomInput): Promise<LeaveOpenRoomOutcome>
}
