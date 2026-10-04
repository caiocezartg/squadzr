import type { Room } from '@domain/entities/room.entity'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'
import type { RoomPlayer } from './get-room-by-code.use-case'

export async function findRoomPlayers(
  room: Room,
  members: IRoomMemberRepository,
  users: IUserRepository
): Promise<RoomPlayer[]> {
  const roster = await members.findByRoomId(room.id)
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
