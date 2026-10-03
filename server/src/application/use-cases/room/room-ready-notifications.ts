import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { User } from '@domain/entities/user.entity'
import type { CreateUserNotificationInput } from '@domain/entities/user-notification.entity'

export interface BuildRoomReadyNotificationsInput {
  readonly room: Pick<Room, 'id' | 'code' | 'name'>
  readonly members: readonly RoomMember[]
  readonly users: readonly Pick<User, 'id' | 'name' | 'avatarUrl'>[]
  readonly gameName: string
}

const TITLE = 'Room ready: your squad is full'

/**
 * One logical `room_ready` notification per member of the authoritative member
 * list. Pure: the join transaction calls it with the members it just locked, so
 * the persisted payload reflects the squad that actually filled the room.
 */
export function buildRoomReadyNotifications(
  input: BuildRoomReadyNotificationsInput
): CreateUserNotificationInput[] {
  const usersById = new Map(input.users.map((user) => [user.id, user]))
  const players = input.members.map((member) => {
    const user = usersById.get(member.userId)
    return { name: user?.name ?? 'Unknown', image: user?.avatarUrl ?? null }
  })

  return input.members.map((member) => ({
    userId: member.userId,
    roomId: input.room.id,
    type: 'room_ready',
    title: TITLE,
    message: `${input.room.name} is ready. Your Discord invite is now available.`,
    payload: {
      roomId: input.room.id,
      roomCode: input.room.code,
      roomName: input.room.name,
      gameName: input.gameName,
      players,
    },
  }))
}
