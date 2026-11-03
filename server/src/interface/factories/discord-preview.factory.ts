import type { Clock } from '@domain/services/clock.interface'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import { DiscordApiInvitePreviewProvider } from '@infrastructure/discord/discord-api-invite-preview-provider'
import { CachedDiscordInvitePreviewProvider } from '@infrastructure/discord/cached-discord-invite-preview-provider'

/**
 * The process's one source of Discord previews: Discord's public invite endpoint behind a cache, which
 * must be shared by every request to keep Discord from hearing from the app more than once per window.
 */
export function createDiscordInvitePreviews(clock: Clock): DiscordInvitePreviewProvider {
  return new CachedDiscordInvitePreviewProvider(new DiscordApiInvitePreviewProvider(), clock)
}
