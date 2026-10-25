import type { Room } from '@domain/entities/room.entity'
import type { RoomMember } from '@domain/entities/room-member.entity'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { RoomPlayer } from '@application/use-cases/room/get-room-by-code.use-case'

/** Host first, then by join time, then by user id. */
function compareRoster(hostId: string) {
  return (a: RoomMember, b: RoomMember): number => {
    if (a.userId === hostId) return b.userId === hostId ? 0 : -1
    if (b.userId === hostId) return 1
    const joined = a.joinedAt.getTime() - b.joinedAt.getTime()
    if (joined !== 0) return joined
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0
  }
}

export async function findRoomPlayers(
  room: Room,
  members: IRoomMemberRepository,
  users: IUserRepository
): Promise<RoomPlayer[]> {
  const roster = [...(await members.findByRoomId(room.id))].sort(compareRoster(room.hostId))
  const roomUsers = await users.findByIds(roster.map((member) => member.userId))
  const userMap = new Map(roomUsers.map((user) => [user.id, user]))

  return roster
    .map((member) => {
      const user = userMap.get(member.userId)
      if (!user) return null
      return {
        id: user.id,
        name: user.name,
        image: user.avatarUrl,
        isHost: user.id === room.hostId,
      }
    })
    .filter((player): player is RoomPlayer => player !== null)
}
