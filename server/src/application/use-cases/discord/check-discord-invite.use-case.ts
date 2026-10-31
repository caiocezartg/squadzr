import type { DiscordInviteCheckResponse } from '@squadzr/schemas'
import type { DiscordInvitePreviewProvider } from '@domain/services/discord-invite-preview-provider.interface'

export interface CheckDiscordInviteInput {
  readonly code: string
}

export interface ICheckDiscordInviteUseCase {
  execute(input: CheckDiscordInviteInput): Promise<DiscordInviteCheckResponse>
}

/**
 * What Discord says about an invite a Squad creator typed. Discord being slow, down or rate limiting is
 * no verdict on the invite, so it comes back as `unknown` rather than `invalid`.
 */
export class CheckDiscordInviteUseCase implements ICheckDiscordInviteUseCase {
  constructor(private readonly previews: DiscordInvitePreviewProvider) {}

  async execute(input: CheckDiscordInviteInput): Promise<DiscordInviteCheckResponse> {
    const outcome = await this.previews.fetch(input.code)

    switch (outcome.kind) {
      case 'found':
        return {
          status: 'valid',
          server: {
            name: outcome.preview.name,
            iconUrl: outcome.preview.iconUrl,
            memberCount: outcome.preview.memberCount,
          },
          expires: outcome.preview.expiresAt !== null,
        }
      case 'invalid':
        return { status: 'invalid' }
      case 'rate_limited':
      case 'unreachable':
        return { status: 'unknown' }
    }
  }
}
