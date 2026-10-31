import type { FastifyInstance } from 'fastify'
import { discordRoutes, type DiscordRoutesOptions } from './discord.routes'
import { healthRoutes } from './health.routes'
import { roomRoutes } from './room.routes'
import { userRoutes } from './user.routes'

export interface RegisterRoutesOptions {
  readonly discord?: DiscordRoutesOptions
}

export async function registerRoutes(
  fastify: FastifyInstance,
  options: RegisterRoutesOptions = {}
): Promise<void> {
  await fastify.register(healthRoutes)
  await fastify.register(discordRoutes, options.discord ?? {})
  await fastify.register(roomRoutes)
  await fastify.register(userRoutes)
}
