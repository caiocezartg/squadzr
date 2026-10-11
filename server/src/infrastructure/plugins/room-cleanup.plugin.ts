import type { FastifyBaseLogger, FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import type { IRoomBroadcaster } from '@domain/services/room-broadcaster.interface'
import type { IDeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { ROOM } from '@config/constants'

export interface RoomCleanupPluginOptions {
  /** Built by the composition root from the database and the clock. */
  readonly deleteExpiredRoomsUseCase: IDeleteExpiredRoomsUseCase
}

/**
 * One cleanup pass. Every failure path is contained here: a scheduler failure
 * is logged and retried on the next tick, never brought down Fastify.
 */
export async function runRoomCleanup(
  log: FastifyBaseLogger,
  useCase: IDeleteExpiredRoomsUseCase,
  broadcaster: IRoomBroadcaster
): Promise<void> {
  try {
    const result = await useCase.execute()

    for (const room of result.deletedRooms) {
      log.info({ roomId: room.id, roomCode: room.code, reason: room.reason }, 'Room expired')

      try {
        broadcaster.broadcastRoomDeleted(room.id, room.code)
      } catch (error) {
        log.error(
          { err: error, roomId: room.id, roomCode: room.code },
          'Room deletion broadcast failed'
        )
      }

      log.info({ roomId: room.id, roomCode: room.code }, 'Room deleted')
    }
  } catch (error) {
    log.error({ err: error }, 'Room cleanup failed')
  }
}

async function roomCleanupPlugin(
  fastify: FastifyInstance,
  { deleteExpiredRoomsUseCase }: RoomCleanupPluginOptions
): Promise<void> {
  let intervalId: ReturnType<typeof setInterval>

  fastify.addHook('onReady', async () => {
    fastify.log.info(
      {
        intervalMs: ROOM.CLEANUP_INTERVAL_MS,
        openRoomTtlMs: ROOM.OPEN_ROOM_TTL_MS,
        readyRoomRetentionMs: ROOM.READY_ROOM_RETENTION_MS,
      },
      'Room cleanup scheduler started'
    )

    intervalId = setInterval(() => {
      void runRoomCleanup(fastify.log, deleteExpiredRoomsUseCase, fastify.broadcaster)
    }, ROOM.CLEANUP_INTERVAL_MS)
  })

  fastify.addHook('onClose', () => {
    clearInterval(intervalId)
  })
}

export default fp(roomCleanupPlugin, {
  name: 'room-cleanup',
  dependencies: ['database', 'websocket-handler'],
})
