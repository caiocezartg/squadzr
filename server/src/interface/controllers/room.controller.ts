import type { FastifyReply, FastifyRequest } from 'fastify'
import type { ICreateRoomUseCase } from '@application/use-cases/room/create-room.use-case'
import type { IGetAvailableRoomsUseCase } from '@application/use-cases/room/get-available-rooms.use-case'
import type { IGetRoomByCodeUseCase } from '@application/use-cases/room/get-room-by-code.use-case'
import type { IJoinRoomUseCase } from '@application/use-cases/room/join-room.use-case'
import type { ILeaveRoomUseCase } from '@application/use-cases/room/leave-room.use-case'
import type { INotifyRoomReadyUseCase } from '@application/use-cases/room/notify-room-ready.use-case'
import type { IGetMyRoomsUseCase } from '@application/use-cases/room/get-my-rooms.use-case'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { RoomNotFoundError, NotRoomMemberError } from '@application/errors'
import { createRoomRequestSchema, roomCodeParamSchema } from '@application/dtos'
import { toMemberRoom, toPublicRoom, toRoomMemberDto } from '@application/projections'

export interface RoomControllerDeps {
  readonly createRoomUseCase: ICreateRoomUseCase
  readonly getAvailableRoomsUseCase: IGetAvailableRoomsUseCase
  readonly getRoomByCodeUseCase: IGetRoomByCodeUseCase
  readonly joinRoomUseCase: IJoinRoomUseCase
  readonly leaveRoomUseCase: ILeaveRoomUseCase
  readonly notifyRoomReadyUseCase: INotifyRoomReadyUseCase
  readonly getMyRoomsUseCase: IGetMyRoomsUseCase
  readonly broadcaster: IRoomBroadcaster
}

export class RoomController {
  constructor(private readonly deps: RoomControllerDeps) {}

  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.session?.user?.id
    const result = await this.deps.getAvailableRoomsUseCase.execute(userId ? { userId } : undefined)

    await reply.send({ rooms: result.rooms.map(toPublicRoom) })
  }

  async getByCode(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const params = roomCodeParamSchema.parse(request.params)
    const result = await this.deps.getRoomByCodeUseCase.execute({
      code: params.code,
      viewerId: request.session?.user?.id,
    })

    if (!result.room) {
      throw new RoomNotFoundError(params.code)
    }

    // Discord invite and roster are lobby details: members only.
    if (!result.isMember) {
      await reply.send({ room: toPublicRoom(result.room) })
      return
    }

    await reply.send({ room: toMemberRoom(result.room), players: result.players })
  }

  async create(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId
    const body = createRoomRequestSchema.parse(request.body)

    const result = await this.deps.createRoomUseCase.execute({
      name: body.name,
      hostId: userId,
      gameId: body.gameId,
      maxPlayers: body.maxPlayers,
      discordLink: body.discordLink,
      tags: body.tags,
      language: body.language,
    })

    this.deps.broadcaster.broadcastRoomCreated(result.room)

    await reply.status(201).send({ room: toMemberRoom(result.room) })
  }

  async join(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId
    const params = roomCodeParamSchema.parse(request.params)

    const { room } = await this.deps.getRoomByCodeUseCase.execute({ code: params.code })
    if (!room) {
      throw new RoomNotFoundError(params.code)
    }

    const result = await this.deps.joinRoomUseCase.execute({
      roomId: room.id,
      userId,
    })

    this.deps.broadcaster.broadcastRoomUpdated(room.id, room.code, result.memberCount)

    if (result.isRoomNowFull) {
      try {
        const notificationResult = await this.deps.notifyRoomReadyUseCase.execute({
          roomId: room.id,
        })
        request.server.log.info(
          {
            roomId: room.id,
            roomCode: room.code,
            ...notificationResult,
          },
          'Room ready notifications processed'
        )
      } catch (error) {
        request.server.log.error(
          {
            roomId: room.id,
            roomCode: room.code,
            error,
          },
          'Failed to process room ready notifications'
        )
      }
    }

    await reply.send({
      message: 'Joined room successfully',
      roomMember: toRoomMemberDto(result.roomMember),
    })
  }

  async leave(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId
    const params = roomCodeParamSchema.parse(request.params)

    const { room } = await this.deps.getRoomByCodeUseCase.execute({ code: params.code })
    if (!room) {
      throw new RoomNotFoundError(params.code)
    }

    const result = await this.deps.leaveRoomUseCase.execute({
      roomId: room.id,
      userId,
    })

    if (!result.success) {
      throw new NotRoomMemberError(userId, room.id)
    }

    if (result.wasHostLeave) {
      this.deps.broadcaster.broadcastRoomDeleted(room.id, room.code)
    } else {
      this.deps.broadcaster.broadcastRoomUpdated(room.id, room.code, result.memberCount)
    }

    await reply.send({
      message: 'Left room successfully',
      success: true,
    })
  }

  async getMyRooms(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.userId
    const result = await this.deps.getMyRoomsUseCase.execute({ userId })

    await reply.send({
      hosted: result.hosted.map(toMemberRoom),
      joined: result.joined.map(toMemberRoom),
    })
  }
}
