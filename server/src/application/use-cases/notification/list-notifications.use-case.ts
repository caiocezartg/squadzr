import type { UserNotification } from '@domain/entities/user-notification.entity'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import type { Clock } from '@domain/services/clock.interface'
import { isRoomExpired } from '@domain/services/room-lifecycle'
import { ROOM } from '@config/constants'

export interface ResolvedUserNotification {
  readonly notification: UserNotification
  /** Invite resolved through the retained room; null once the room expired. */
  readonly discordLink: string | null
}

export interface ListNotificationsInput {
  readonly userId: string
  readonly limit: number
}

export interface ListNotificationsOutput {
  readonly notifications: ResolvedUserNotification[]
}

export interface IListNotificationsUseCase {
  execute(input: ListNotificationsInput): Promise<ListNotificationsOutput>
}

export class ListNotificationsUseCase implements IListNotificationsUseCase {
  constructor(
    private readonly userNotificationRepository: IUserNotificationRepository,
    private readonly roomRepository: IRoomRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: ListNotificationsInput): Promise<ListNotificationsOutput> {
    const notifications = await this.userNotificationRepository.findByUserId(
      input.userId,
      input.limit
    )

    const roomIds = [
      ...new Set(
        notifications
          .map((notification) => notification.roomId)
          .filter((roomId): roomId is string => roomId !== null)
      ),
    ]
    const rooms = await this.roomRepository.findByIds(roomIds)
    const roomsById = new Map(rooms.map((room) => [room.id, room]))
    const now = this.clock.now()

    return {
      notifications: notifications.map((notification) => {
        // The payload never stores the invite: it is resolved here, and only
        // while the room is still retained. A notification may outlive its
        // room without ever revealing the link.
        const room = notification.roomId ? roomsById.get(notification.roomId) : undefined
        const discordLink = room && !isRoomExpired(room, now, ROOM) ? room.discordLink : null
        return { notification, discordLink }
      }),
    }
  }
}
