import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { DrizzleRoomRepository } from '@infrastructure/repositories/drizzle-room.repository'
import { DeleteExpiredRoomsUseCase } from '@application/use-cases/room/delete-expired-rooms.use-case'
import { ROOM } from '@config/constants'

async function roomCleanupPlugin(fastify: FastifyInstance): Promise<void> {
  let intervalId: ReturnType<typeof setInterval>

  fastify.addHook('onReady', async () => {
    fastify.log.info(
      `Room cleanup scheduler started (interval: ${ROOM.CLEANUP_INTERVAL_MS / 1000}s, expiration: ${ROOM.EXPIRATION_MINUTES}min)`
    )

    const cleanupRepository = new DrizzleRoomRepository(fastify.db)
    const cleanupUseCase = new DeleteExpiredRoomsUseCase(cleanupRepository)

    intervalId = setInterval(async () => {
      try {
        const result = await cleanupUseCase.execute({ expirationMinutes: ROOM.EXPIRATION_MINUTES })

        for (const room of result.deletedRooms) {
          fastify.broadcaster.broadcastRoomDeleted(room.id, room.code)
        }

        if (result.deletedRooms.length > 0) {
          fastify.log.info(`Cleaned up ${result.deletedRooms.length} expired room(s)`)
        }
      } catch (error) {
        fastify.log.error(error, 'Room cleanup failed')
      }
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
