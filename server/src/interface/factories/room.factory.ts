import type { Database } from '@infrastructure/database/drizzle'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import type { Clock } from '@domain/services/clock.interface'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DrizzleRoomMemberRepository } from '@infrastructure/repositories/drizzle-room-member.repository'
import { DrizzleGameRepository } from '@infrastructure/repositories/drizzle-game.repository'
import { DrizzleUserRepository } from '@infrastructure/repositories/drizzle-user.repository'
import { CreateRoomUseCase } from '@application/use-cases/room/create-room.use-case'
import { GetAvailableRoomsUseCase } from '@application/use-cases/room/get-available-rooms.use-case'
import { GetDiscordPreviewUseCase } from '@application/use-cases/room/get-discord-preview.use-case'
import { GetRoomByCodeUseCase } from '@application/use-cases/room/get-room-by-code.use-case'
import { JoinRoomUseCase } from '@application/use-cases/room/join-room.use-case'
import { LeaveRoomUseCase } from '@application/use-cases/room/leave-room.use-case'
import { GetMyRoomsUseCase } from '@application/use-cases/room/get-my-rooms.use-case'
import { RoomController } from '@interface/controllers/room.controller'

export function createRoomController(
  db: Database,
  broadcaster: IRoomBroadcaster,
  clock: Clock,
  discordPreviews: DiscordInvitePreviewProvider
) {
  const roomRepository = new DrizzleRoomRepository(db, clock)
  const roomMemberRepository = new DrizzleRoomMemberRepository(db, clock)
  const gameRepository = new DrizzleGameRepository(db, clock)
  const userRepository = new DrizzleUserRepository(db)

  const createRoomUseCase = new CreateRoomUseCase(roomRepository, gameRepository, userRepository)
  const getAvailableRoomsUseCase = new GetAvailableRoomsUseCase(
    roomRepository,
    roomMemberRepository,
    clock
  )
  const getRoomByCodeUseCase = new GetRoomByCodeUseCase(
    roomRepository,
    roomMemberRepository,
    userRepository,
    clock
  )
  const getDiscordPreviewUseCase = new GetDiscordPreviewUseCase(
    roomRepository,
    roomMemberRepository,
    clock,
    discordPreviews
  )
  const joinRoomUseCase = new JoinRoomUseCase(
    roomRepository,
    roomMemberRepository,
    gameRepository,
    clock
  )
  const leaveRoomUseCase = new LeaveRoomUseCase(roomRepository, roomMemberRepository, clock)
  const getMyRoomsUseCase = new GetMyRoomsUseCase(roomRepository, clock)

  return new RoomController({
    createRoomUseCase,
    getAvailableRoomsUseCase,
    getRoomByCodeUseCase,
    getDiscordPreviewUseCase,
    joinRoomUseCase,
    leaveRoomUseCase,
    getMyRoomsUseCase,
    broadcaster,
  })
}
