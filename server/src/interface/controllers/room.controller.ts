import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { CreateRoomInput, roomCodeParamSchema } from '@squadzr/schemas'
import type { ICreateRoomUseCase } from '@application/use-cases/room/create-room.use-case'
import type { IGetAvailableRoomsUseCase } from '@application/use-cases/room/get-available-rooms.use-case'
import type { IGetRoomByCodeUseCase } from '@application/use-cases/room/get-room-by-code.use-case'
import type { IJoinRoomUseCase } from '@application/use-cases/room/join-room.use-case'
import type { ILeaveRoomUseCase } from '@application/use-cases/room/leave-room.use-case'
import type { IGetMyRoomsUseCase } from '@application/use-cases/room/get-my-rooms.use-case'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import { AppError, RoomNotFoundError, NotRoomMemberError } from '@application/errors'
import { toMemberRoom, toPublicRoom, toRoomMemberDto } from '@application/projections'

type RoomCodeParams = z.infer<typeof roomCodeParamSchema>

export interface RoomControllerDeps {
  readonly createRoomUseCase: ICreateRoomUseCase
  readonly getAvailableRoomsUseCase: IGetAvailableRoomsUseCase
  readonly getRoomByCodeUseCase: IGetRoomByCodeUseCase
  readonly joinRoomUseCase: IJoinRoomUseCase
  readonly leaveRoomUseCase: ILeaveRoomUseCase
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

  async getByCode(
    request: FastifyRequest<{ Params: RoomCodeParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const params = request.params
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

  async create(
    request: FastifyRequest<{ Body: CreateRoomInput }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.userId
    const body = request.body

    const result = await this.deps.createRoomUseCase.execute({
      name: body.name,
      hostId: userId,
      gameId: body.gameId,
      maxPlayers: body.maxPlayers,
      discordLink: body.discordLink,
      tags: body.tags,
      language: body.language,
    })

    request.server.log.info(
      { roomId: result.room.id, roomCode: result.room.code, hostId: userId },
      'Room created'
    )

    // After commit: the room row and its host Membership already exist.
    this.deps.broadcaster.broadcastRoomCreated(result.room)

    await reply.status(201).send({ room: toMemberRoom(result.room) })
  }

  async join(
    request: FastifyRequest<{ Params: RoomCodeParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.userId
    const params = request.params

    let result
    try {
      result = await this.deps.joinRoomUseCase.execute({
        code: params.code,
        userId,
      })
    } catch (error) {
      // A transaction failure rolls back Membership, Room Activity, readiness
      // and notifications together; the room stays open and untouched.
      if (!(error instanceof AppError)) {
        request.server.log.error(
          { err: error, roomCode: params.code, userId },
          'Room join failed — activity, readiness and notifications rolled back'
        )
      }
      throw error
    }

    const { room } = result

    request.server.log.info(
      {
        roomId: room.id,
        roomCode: room.code,
        userId,
        memberCount: result.memberCount,
        becameReady: result.isRoomNowFull,
      },
      'Room joined'
    )

    // After commit: the catalog hint reflects the durable Membership change.
    this.deps.broadcaster.broadcastRoomUpdated(room.id, room.code)

    if (result.isRoomNowFull) {
      request.server.log.info(
        { roomId: room.id, roomCode: room.code, memberCount: result.memberCount },
        'Room ready'
      )

      // Best-effort realtime push: the notifications are already persisted, so
      // a failed push never loses them (the next fetch returns them).
      for (const notification of result.createdNotifications) {
        try {
          this.deps.broadcaster.broadcastNotification(notification, room.discordLink)
        } catch (error) {
          request.server.log.error(
            {
              err: error,
              roomId: room.id,
              roomCode: room.code,
              notificationId: notification.id,
              userId: notification.userId,
            },
            'Room ready notification push failed'
          )
        }
      }
    }

    await reply.send({
      message: 'Joined room successfully',
      roomMember: toRoomMemberDto(result.roomMember),
    })
  }

  async leave(
    request: FastifyRequest<{ Params: RoomCodeParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const userId = request.userId
    const params = request.params

    const { room } = await this.deps.getRoomByCodeUseCase.execute({
      code: params.code,
      viewerId: userId,
    })
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

    // After commit: the deletion or the new member count is durable.
    if (result.wasHostLeave) {
      request.server.log.info(
        { roomId: room.id, roomCode: room.code, userId },
        'Room deleted (host left)'
      )
      this.deps.broadcaster.broadcastRoomDeleted(room.id, room.code)
    } else {
      request.server.log.info(
        { roomId: room.id, roomCode: room.code, userId, memberCount: result.memberCount },
        'Room left'
      )
      this.deps.broadcaster.broadcastRoomUpdated(room.id, room.code)
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
