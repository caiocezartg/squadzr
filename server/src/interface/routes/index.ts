import type { FastifyInstance } from 'fastify'
import { discordRoutes } from './discord.routes'
import { healthRoutes } from './health.routes'
import { roomRoutes } from './room.routes'
import { userRoutes } from './user.routes'

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  await fastify.register(healthRoutes)
  await fastify.register(discordRoutes)
  await fastify.register(roomRoutes)
  await fastify.register(userRoutes)
}
