import type { Clock } from '@domain/services/clock.interface'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'
import {
  DiscordApiInvitePreviewProvider,
  type DiscordLookupLogger,
} from '@infrastructure/discord/discord-api-invite-preview-provider'
import { CachedDiscordInvitePreviewProvider } from '@infrastructure/discord/cached-discord-invite-preview-provider'

export interface DiscordInvitePreviewsOptions {
  /** Authenticates the lookup as a Discord application's bot; unset, the lookup carries no credentials. */
  readonly botToken?: string
  readonly logger?: DiscordLookupLogger
}

/**
 * The process's one source of Discord previews: Discord's invite endpoint behind a cache, which must be
 * shared by every request to keep Discord from hearing from the app more than once per window.
 */
export function createDiscordInvitePreviews(
  clock: Clock,
  { botToken, logger }: DiscordInvitePreviewsOptions = {}
): DiscordInvitePreviewProvider {
  return new CachedDiscordInvitePreviewProvider(
    new DiscordApiInvitePreviewProvider({
      ...(botToken === undefined ? {} : { botToken }),
      ...(logger === undefined ? {} : { logger }),
    }),
    clock
  )
}
