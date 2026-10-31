import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireAuth } from '@interface/hooks/auth.hook'
import { createDiscordController } from '@interface/factories/discord.factory'
import {
  discordInviteCheckResponseSchema,
  discordInviteCodeParamSchema,
  errorResponseSchema as errorResponse,
} from '@squadzr/schemas'

export async function discordRoutes(fastify: FastifyInstance): Promise<void> {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const discordController = createDiscordController(fastify.discordPreviews)

  app.get('/api/discord/invites/:code', {
    schema: {
      tags: ['Discord'],
      summary: 'Check a Discord invite',
      description:
        'Asks Discord whether an invite code exists, as the create form does while a Squad host types the link. Returns the server behind a valid invite and whether the invite expires, `invalid` for an invite Discord does not know, and `unknown` when Discord could not be asked (slow, down or rate limiting). Answers are cached by the server. Requires authentication.',
      security: [{ session: [] }],
      params: discordInviteCodeParamSchema,
      response: {
        200: discordInviteCheckResponseSchema,
        400: errorResponse,
        401: errorResponse,
      },
    },
    preHandler: requireAuth,
    handler: discordController.checkInvite.bind(discordController),
  })
}
