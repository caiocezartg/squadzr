import type { FastifyReply, FastifyRequest } from 'fastify'
import type { z } from 'zod'
import type { discordInviteCodeParamSchema } from '@squadzr/schemas'
import type { ICheckDiscordInviteUseCase } from '@application/use-cases/discord/check-discord-invite.use-case'

type DiscordInviteParams = z.infer<typeof discordInviteCodeParamSchema>

export class DiscordController {
  constructor(private readonly checkDiscordInviteUseCase: ICheckDiscordInviteUseCase) {}

  async checkInvite(
    request: FastifyRequest<{ Params: DiscordInviteParams }>,
    reply: FastifyReply
  ): Promise<void> {
    const result = await this.checkDiscordInviteUseCase.execute({ code: request.params.code })

    await reply.send(result)
  }
}
