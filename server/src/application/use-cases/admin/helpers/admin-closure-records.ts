import type { ClosedSquad } from '@domain/entities/admin-squad.entity'
import type { NewAuditEntry } from '@domain/entities/audit-entry.entity'
import type { CreateUserNotificationInput } from '@domain/entities/user-notification.entity'

/** The admin who closes a Squad, as the Audit Entry snapshots them. */
export interface ClosureActor {
  readonly id: string
  readonly name: string
}

const ROOM_CLOSED_BY_ADMIN_TITLE = 'Squad closed'

/**
 * What an Admin Closure tells the members: one `room_closed_by_admin` per member, the host included,
 * carrying the admin's reason and never the admin. Pure: no I/O, no clock.
 */
export function buildAdminClosureNotifications(
  squad: ClosedSquad,
  reason: string
): CreateUserNotificationInput[] {
  return squad.memberIds.map(
    (userId): CreateUserNotificationInput => ({
      userId,
      roomId: squad.roomId,
      type: 'room_closed_by_admin',
      title: ROOM_CLOSED_BY_ADMIN_TITLE,
      message: `${squad.roomName} was closed by Squadzr moderation.`,
      payload: {
        roomId: squad.roomId,
        roomCode: squad.roomCode,
        roomName: squad.roomName,
        gameName: squad.gameName,
        ...(squad.gameCoverUrl === undefined ? {} : { gameCoverUrl: squad.gameCoverUrl }),
        reason,
      },
    })
  )
}

/** The `squad_closed` Audit Entry: the actor, the reason and a snapshot of the Squad that is gone. */
export function buildAdminClosureAuditEntry(
  actor: ClosureActor,
  reason: string
): (squad: ClosedSquad, closedAt: Date) => NewAuditEntry {
  return (squad, closedAt) => ({
    actorId: actor.id,
    actorName: actor.name,
    action: 'squad_closed',
    target: {
      type: 'squad',
      id: squad.roomId,
      name: squad.roomName,
      code: squad.roomCode,
      game: squad.gameName,
    },
    reason,
    details: null,
    createdAt: closedAt,
  })
}
