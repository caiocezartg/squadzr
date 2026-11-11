export type UserNotificationType =
  | 'room_ready'
  | 'member_left'
  | 'host_transferred'
  | 'room_closed'
  | 'room_closed_by_admin'

/** A person a notification talks about. */
export interface NotificationPerson {
  readonly name: string
  readonly image: string | null
}

/**
 * What every type says about its Squad. No payload ever stores the Discord invite: the
 * link is resolved at read time through the authorized room while the room is retained,
 * and only for `room_ready`, so an expired notification can outlive the room without
 * revealing anything.
 */
export interface NotificationSquadPayload {
  readonly roomId: string
  readonly roomCode: string
  readonly roomName: string
  readonly gameName: string
  /** Absent in notifications written before the catalog gained covers (CCC-95). */
  readonly gameCoverUrl?: string
}

export interface RoomReadyPayload extends NotificationSquadPayload {
  readonly players: ReadonlyArray<NotificationPerson>
  /** The other Open Squads this member left when this one became Ready. */
  readonly leftSquads?: ReadonlyArray<{ readonly roomCode: string; readonly roomName: string }>
}

export interface HostTransferredPayload extends NotificationSquadPayload {
  readonly previousHost: NotificationPerson
  readonly reason: 'squad_completed'
}

export interface MemberLeftPayload extends NotificationSquadPayload {
  readonly member: NotificationPerson
  readonly reason: 'squad_completed'
}

export interface RoomClosedPayload extends NotificationSquadPayload {
  readonly previousHost: NotificationPerson
  readonly reason: 'no_eligible_host'
}

/** A Squad an admin closed. The reason is the admin's own words; the admin is never named. */
export interface RoomClosedByAdminPayload extends NotificationSquadPayload {
  readonly reason: string
}

/** Each type with the payload it owns, so the pair cannot drift. */
export type UserNotificationContent =
  | { readonly type: 'room_ready'; readonly payload: RoomReadyPayload }
  | { readonly type: 'host_transferred'; readonly payload: HostTransferredPayload }
  | { readonly type: 'member_left'; readonly payload: MemberLeftPayload }
  | { readonly type: 'room_closed'; readonly payload: RoomClosedPayload }
  | { readonly type: 'room_closed_by_admin'; readonly payload: RoomClosedByAdminPayload }

export type UserNotificationPayload = UserNotificationContent['payload']

export type UserNotification = {
  readonly id: string
  readonly userId: string
  /** No foreign key to `rooms`: the notification survives the room. */
  readonly roomId: string | null
  readonly title: string
  readonly message: string
  readonly readAt: Date | null
  readonly createdAt: Date
} & UserNotificationContent

export type CreateUserNotificationInput = {
  readonly userId: string
  readonly roomId: string | null
  readonly title: string
  readonly message: string
} & UserNotificationContent
