import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type {
  adminSquadIdParamSchema,
  adminSquadsQuerySchema,
  closeSquadInputSchema,
} from '@squadzr/schemas'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import type { ICloseSquadUseCase } from '@application/use-cases/admin/close-squad.use-case'
import type { IGetAdminSquadUseCase } from '@application/use-cases/admin/get-admin-squad.use-case'
import type { IListAdminSquadsUseCase } from '@application/use-cases/admin/list-admin-squads.use-case'
import { toAdminSquadDetailDto, toAdminSquadDto } from '@application/projections'

type SquadsQuery = z.infer<typeof adminSquadsQuerySchema>
type SquadParams = z.infer<typeof adminSquadIdParamSchema>
type CloseBody = z.infer<typeof closeSquadInputSchema>

export interface AdminSquadsControllerDeps {
  readonly listAdminSquadsUseCase: IListAdminSquadsUseCase
  readonly getAdminSquadUseCase: IGetAdminSquadUseCase
  readonly closeSquadUseCase: ICloseSquadUseCase
  readonly broadcaster: IRoomBroadcaster
}

export class AdminSquadsController {
  constructor(private readonly deps: AdminSquadsControllerDeps) {}

  async list(
    request: FastifyRequest<{ Querystring: SquadsQuery }>,
    reply: FastifyReply
  ): Promise<void> {
    const { page, q, gameId, platform, language, sort } = request.query
    const result = await this.deps.listAdminSquadsUseCase.execute({
      page,
      q,
      gameId,
      platform,
      language,
      sort,
    })

    await reply.send({
      items: result.squads.map(toAdminSquadDto),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    })
  }

  async get(request: FastifyRequest<{ Params: SquadParams }>, reply: FastifyReply): Promise<void> {
    const squad = await this.deps.getAdminSquadUseCase.execute({ roomId: request.params.id })

    await reply.send({ squad: toAdminSquadDetailDto(squad) })
  }

  async close(
    request: FastifyRequest<{ Params: SquadParams; Body: CloseBody }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.deps.closeSquadUseCase.execute({
      roomId: request.params.id,
      reason: request.body.reason,
      actor: { id: request.userId, name: request.session?.user.name ?? '' },
    })

    request.server.log.info(
      {
        roomId: result.roomId,
        roomCode: result.roomCode,
        adminId: request.userId,
        notified: result.notifications.length,
      },
      'Room closed by an admin'
    )

    // After commit, like a Squad its host ended: the lobby hears `room_deleted`, the board
    // `room_removed`, and every member gets the notification live. The push is best-effort: the
    // notifications are persisted, so a failed push is never lost.
    this.deps.broadcaster.broadcastRoomDeleted(result.roomId, result.roomCode)
    for (const notification of result.notifications) {
      try {
        this.deps.broadcaster.broadcastNotification(notification, null)
      } catch (error) {
        request.server.log.error(
          {
            err: error,
            roomId: result.roomId,
            notificationId: notification.id,
            userId: notification.userId,
          },
          'Admin closure notification push failed'
        )
      }
    }

    await reply.code(204).send()
  }
}
