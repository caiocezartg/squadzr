import type { User } from '@domain/entities/user.entity'
import type {
  CreateUserNotificationInput,
  NotificationPerson,
  NotificationSquadPayload,
} from '@domain/entities/user-notification.entity'
import type { SquadDeparture } from '@domain/services/squad-release'

export interface BuildSquadReleaseNotificationsInput {
  readonly departures: readonly SquadDeparture[]
  /** Profiles of everyone who left: they all were members of the Squad that became Ready. */
  readonly users: readonly Pick<User, 'id' | 'name' | 'avatarUrl'>[]
}

const HOST_TRANSFERRED_TITLE = 'You are the new squad owner'
const MEMBER_LEFT_TITLE = 'A member left your squad'
const ROOM_CLOSED_TITLE = 'Squad closed'

/**
 * What the Squad Release tells the people it left behind, one entry per notification:
 * - `host_transferred` to the member who inherited the Squad;
 * - `member_left` to the host the Squad has afterwards, for each leaver who was not the old host;
 * - `room_closed` to every remaining member of a Squad nobody could take over.
 * A Squad deleted for being left empty tells nobody. Pure: no I/O, no clock.
 */
export function buildSquadReleaseNotifications(
  input: BuildSquadReleaseNotificationsInput
): CreateUserNotificationInput[] {
  const people = new Map(
    input.users.map((user): [string, NotificationPerson] => [
      user.id,
      { name: user.name, image: user.avatarUrl },
    ])
  )
  const personOf = (userId: string): NotificationPerson =>
    people.get(userId) ?? { name: 'Unknown', image: null }

  return input.departures.flatMap((departure) => {
    const squad = squadFields(departure)
    const previousHost = personOf(departure.previousHostId)

    if (departure.outcome === 'closed') {
      return departure.remainingUserIds.map(
        (userId): CreateUserNotificationInput => ({
          userId,
          roomId: departure.roomId,
          type: 'room_closed',
          title: ROOM_CLOSED_TITLE,
          message: `${departure.roomName} was closed: ${previousHost.name}, the owner, left and nobody who stayed could take over.`,
          payload: { ...squad, previousHost, reason: 'no_eligible_host' },
        })
      )
    }
    if (departure.outcome === 'deleted') return []

    const hostId = departure.newHostId ?? departure.previousHostId
    const transferred: CreateUserNotificationInput[] =
      departure.newHostId === null
        ? []
        : [
            {
              userId: departure.newHostId,
              roomId: departure.roomId,
              type: 'host_transferred',
              title: HOST_TRANSFERRED_TITLE,
              message: `You now own ${departure.roomName}. ${previousHost.name} left because their squad was completed.`,
              payload: { ...squad, previousHost, reason: 'squad_completed' },
            },
          ]
    const left = departure.removedUserIds
      .filter((userId) => userId !== departure.previousHostId)
      .map((userId): CreateUserNotificationInput => {
        const member = personOf(userId)
        return {
          userId: hostId,
          roomId: departure.roomId,
          type: 'member_left',
          title: MEMBER_LEFT_TITLE,
          message: `${member.name} left ${departure.roomName} because another squad of theirs was completed.`,
          payload: { ...squad, member, reason: 'squad_completed' },
        }
      })
    return [...transferred, ...left]
  })
}

function squadFields(departure: SquadDeparture): NotificationSquadPayload {
  return {
    roomId: departure.roomId,
    roomCode: departure.roomCode,
    roomName: departure.roomName,
    gameName: departure.gameName,
    ...(departure.gameCoverUrl === undefined ? {} : { gameCoverUrl: departure.gameCoverUrl }),
  }
}
