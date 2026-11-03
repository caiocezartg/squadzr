import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import { CheckDiscordInviteUseCase } from '@application/use-cases/discord/check-discord-invite.use-case'
import { DiscordController } from '@interface/controllers/discord.controller'

export function createDiscordController(discordPreviews: DiscordInvitePreviewProvider) {
  return new DiscordController(new CheckDiscordInviteUseCase(discordPreviews))
}
