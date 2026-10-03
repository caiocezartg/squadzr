export type UserNotificationType = 'room_ready'

/**
 * Persisted payload of a `room_ready` notification. It deliberately never
 * stores the Discord invite: the link is resolved at read time through the
 * authorized room while the room is retained, so an expired notification can
 * outlive the room without revealing anything.
 */
export interface UserNotificationPayload {
  readonly roomId: string
  readonly roomCode: string
  readonly roomName: string
  readonly gameName: string
  readonly players: ReadonlyArray<{ readonly name: string; readonly image: string | null }>
}

export interface UserNotification {
  readonly id: string
  readonly userId: string
  /** No foreign key to `rooms`: the notification survives the room. */
  readonly roomId: string | null
  readonly type: UserNotificationType
  readonly title: string
  readonly message: string
  readonly payload: UserNotificationPayload
  readonly readAt: Date | null
  readonly createdAt: Date
}

export interface CreateUserNotificationInput {
  readonly userId: string
  readonly roomId: string | null
  readonly type: UserNotificationType
  readonly title: string
  readonly message: string
  readonly payload: UserNotificationPayload
}
