import type { UserNotificationDto } from '@squadzr/schemas'
import type {
  NotificationSquadPayload,
  UserNotification,
} from '@domain/entities/user-notification.entity'

function squadFields(payload: NotificationSquadPayload) {
  return {
    roomId: payload.roomId,
    roomCode: payload.roomCode,
    roomName: payload.roomName,
    gameName: payload.gameName,
    ...(payload.gameCoverUrl === undefined ? {} : { gameCoverUrl: payload.gameCoverUrl }),
  }
}

/**
 * Notification as its owner sees it; never sent to anyone but `notification.userId`.
 * `discordLink` is resolved at read time through the retained room, never stored, and
 * only `room_ready` carries it: a notification of any other type drops it.
 */
export function toUserNotificationDto(
  notification: UserNotification,
  discordLink: string | null
): UserNotificationDto {
  const base = {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    message: notification.message,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }

  switch (notification.type) {
    case 'room_ready': {
      const { payload } = notification
      return {
        ...base,
        type: 'room_ready',
        payload: {
          ...squadFields(payload),
          players: payload.players.map((player) => ({ name: player.name, image: player.image })),
          discordLink,
          ...(payload.leftSquads === undefined
            ? {}
            : {
                leftSquads: payload.leftSquads.map((squad) => ({
                  roomCode: squad.roomCode,
                  roomName: squad.roomName,
                })),
              }),
        },
      }
    }
    case 'host_transferred': {
      const { payload } = notification
      return {
        ...base,
        type: 'host_transferred',
        payload: {
          ...squadFields(payload),
          previousHost: { name: payload.previousHost.name, image: payload.previousHost.image },
          reason: payload.reason,
        },
      }
    }
    case 'member_left': {
      const { payload } = notification
      return {
        ...base,
        type: 'member_left',
        payload: {
          ...squadFields(payload),
          member: { name: payload.member.name, image: payload.member.image },
          reason: payload.reason,
        },
      }
    }
    case 'room_closed': {
      const { payload } = notification
      return {
        ...base,
        type: 'room_closed',
        payload: {
          ...squadFields(payload),
          previousHost: { name: payload.previousHost.name, image: payload.previousHost.image },
          reason: payload.reason,
        },
      }
    }
    case 'room_closed_by_admin': {
      const { payload } = notification
      return {
        ...base,
        type: 'room_closed_by_admin',
        payload: { ...squadFields(payload), reason: payload.reason },
      }
    }
  }
}
