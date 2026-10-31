import type { FastifyPluginAsync } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { requireAuth } from '@interface/hooks/auth.hook'
import { createDiscordController } from '@interface/factories/discord.factory'
import {
  discordInviteCheckResponseSchema,
  discordInviteCodeParamSchema,
  errorResponseSchema as errorResponse,
} from '@squadzr/schemas'

/** How often one signed-in user may ask Discord about an invite. */
export interface DiscordInviteRateLimit {
  readonly max: number
  readonly timeWindowMs: number
}

/** Thirty checks a minute: far above a host pasting links into the create form, far below a loop. */
export const DEFAULT_DISCORD_INVITE_RATE_LIMIT: DiscordInviteRateLimit = {
  max: 30,
  timeWindowMs: 60_000,
}

export interface DiscordRoutesOptions {
  /** @default DEFAULT_DISCORD_INVITE_RATE_LIMIT */
  readonly rateLimit?: DiscordInviteRateLimit
}

export const discordRoutes: FastifyPluginAsync<DiscordRoutesOptions> = async (
  fastify,
  { rateLimit = DEFAULT_DISCORD_INVITE_RATE_LIMIT }
) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>()
  const discordController = createDiscordController(fastify.discordPreviews)

  app.get('/api/discord/invites/:code', {
    schema: {
      tags: ['Discord'],
      summary: 'Check a Discord invite',
      description: `Asks Discord whether an invite code exists, as the create form does while a Squad host types the link. Returns the server behind a valid invite and whether the invite expires, \`invalid\` for an invite Discord does not know, and \`unknown\` when Discord could not be asked (slow, down or rate limiting). Answers are cached by the server. Requires authentication. Each user may make ${rateLimit.max} checks per ${rateLimit.timeWindowMs / 1000} seconds; beyond that the route answers 429 \`RATE_LIMITED\`, and the \`Retry-After\` header says how long to wait.`,
      security: [{ session: [] }],
      params: discordInviteCodeParamSchema,
      response: {
        200: discordInviteCheckResponseSchema,
        400: errorResponse,
        401: errorResponse,
        429: errorResponse,
      },
    },
    // The limit runs after `requireAuth` (see the rate-limit plugin's registration), so it counts the
    // signed-in user's requests and an unauthenticated one answers 401 without spending any quota.
    config: {
      rateLimit: {
        max: rateLimit.max,
        timeWindow: rateLimit.timeWindowMs,
        keyGenerator: (request) => request.session?.user?.id ?? request.ip,
      },
    },
    preHandler: requireAuth,
    handler: discordController.checkInvite.bind(discordController),
  })
}
