import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { User } from '@domain/entities/user.entity'
import type { CreateUserNotificationInput } from '@domain/entities/user-notification.entity'
import type { SquadDeparture } from '@domain/services/squad-release'

export interface BuildRoomReadyNotificationsInput {
  readonly room: Pick<Room, 'id' | 'code' | 'name'>
  readonly members: readonly RoomMember[]
  readonly users: readonly Pick<User, 'id' | 'name' | 'avatarUrl'>[]
  readonly gameName: string
  /** Absent when the room's game could not be resolved (CCC-95). */
  readonly gameCoverUrl?: string
  /** What the Squad Release did to the members' other Open Squads; empty when it did nothing. */
  readonly departures?: readonly SquadDeparture[]
}

export type RoomReadyNotificationInput = Extract<
  CreateUserNotificationInput,
  { type: 'room_ready' }
>

const TITLE = 'Room ready: your squad is full'

/**
 * One logical `room_ready` notification per member of the authoritative member
 * list. Pure: the join transaction calls it with the members it just locked, so
 * the persisted payload reflects the squad that actually filled the room. Each
 * notification lists the other Squads its member left, those deleted included.
 */
export function buildRoomReadyNotifications(
  input: BuildRoomReadyNotificationsInput
): RoomReadyNotificationInput[] {
  const usersById = new Map(input.users.map((user) => [user.id, user]))
  const players = input.members.map((member) => {
    const user = usersById.get(member.userId)
    return { name: user?.name ?? 'Unknown', image: user?.avatarUrl ?? null }
  })

  return input.members.map((member) => {
    const leftSquads = squadsLeftBy(member.userId, input.departures ?? [])
    return {
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
        ...(input.gameCoverUrl === undefined ? {} : { gameCoverUrl: input.gameCoverUrl }),
        players,
        ...(leftSquads.length === 0 ? {} : { leftSquads }),
      },
    }
  })
}

function squadsLeftBy(userId: string, departures: readonly SquadDeparture[]) {
  return departures
    .filter((departure) => departure.removedUserIds.includes(userId))
    .map((departure) => ({ roomCode: departure.roomCode, roomName: departure.roomName }))
}
