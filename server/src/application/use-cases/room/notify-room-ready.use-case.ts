import type { IGameRepository } from '@domain/repositories/game.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IUserNotificationRepository } from '@domain/repositories/user-notification.repository'
import type { IUserRepository } from '@domain/repositories/user.repository'

export interface NotifyRoomReadyInput {
  readonly roomId: string
}

export interface NotifyRoomReadyOutput {
  readonly inAppCreated: number
}

export interface INotifyRoomReadyUseCase {
  execute(input: NotifyRoomReadyInput): Promise<NotifyRoomReadyOutput>
}

export class NotifyRoomReadyUseCase implements INotifyRoomReadyUseCase {
  constructor(
    private readonly roomRepository: IRoomRepository,
    private readonly roomMemberRepository: IRoomMemberRepository,
    private readonly userRepository: IUserRepository,
    private readonly gameRepository: IGameRepository,
    private readonly userNotificationRepository: IUserNotificationRepository
  ) {}

  async execute(input: NotifyRoomReadyInput): Promise<NotifyRoomReadyOutput> {
    const room = await this.roomRepository.findById(input.roomId)
    if (!room) {
      return { inAppCreated: 0 }
    }

    const game = await this.gameRepository.findById(room.gameId)
    const gameName = game?.name ?? 'Unknown game'

    const members = await this.roomMemberRepository.findByRoomId(room.id)
    const userIds = [...new Set(members.map((member) => member.userId))]

    const users = await this.userRepository.findByIds(userIds)
    const usersById = new Map(users.map((u) => [u.id, u]))
    const players = userIds.map((userId) => {
      const u = usersById.get(userId)
      return { name: u?.name ?? 'Unknown', image: u?.avatarUrl ?? null }
    })

    const title = 'Room ready: your squad is full'
    const message = `${room.name} is ready. Your Discord invite is now available.`

    const payload = {
      roomId: room.id,
      roomCode: room.code,
      roomName: room.name,
      gameName,
      players,
      discordLink: room.discordLink,
    }

    await Promise.all(
      userIds.map((userId) =>
        this.userNotificationRepository.create({
          userId,
          roomId: room.id,
          type: 'room_ready',
          title,
          message,
          payload,
        })
      )
    )

    return { inAppCreated: userIds.length }
  }
}
