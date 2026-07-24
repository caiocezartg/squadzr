import type { FastifyInstance } from 'fastify'
import { healthRoutes } from './health.routes'
import { roomRoutes } from './room.routes'
import { squadRoutes } from './squad.routes'
import { userRoutes } from './user.routes'

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes)
  await fastify.register(roomRoutes)
  await fastify.register(squadRoutes)
  await fastify.register(userRoutes)
}
