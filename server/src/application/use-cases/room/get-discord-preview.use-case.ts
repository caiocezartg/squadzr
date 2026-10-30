import { discordInviteCode } from '@squadzr/schemas'
import type { IRoomRepository } from '@domain/repositories/room.repository'
import type { IRoomMemberRepository } from '@domain/repositories/room-member.repository'
import type { Clock } from '@domain/services/clock.interface'
import type {
  DiscordInvitePreviewProvider,
  DiscordServerPreview,
} from '@domain/services/discord-invite-preview-provider.interface'
import { RoomNotFoundError, RoomNotReadyError } from '@application/errors'
import { resolveAccessibleRoom } from './helpers/resolve-accessible-room'

export interface GetDiscordPreviewInput {
  readonly code: string
  readonly viewerId: string
}

export interface GetDiscordPreviewOutput {
  /** `null` whenever Discord has nothing to show for the invite: the caller falls back to the Squad's own data. */
  readonly preview: DiscordServerPreview | null
}

export interface IGetDiscordPreviewUseCase {
  execute(input: GetDiscordPreviewInput): Promise<GetDiscordPreviewOutput>
}

/**
 * The Discord server behind a Ready Squad's invite. Only a member of a Ready Squad may ask: anyone else
 * would learn from it what the Squad keeps behind its lock.
 */
export class GetDiscordPreviewUseCase implements IGetDiscordPreviewUseCase {
  constructor(
    private readonly rooms: IRoomRepository,
    private readonly members: IRoomMemberRepository,
    private readonly clock: Clock,
    private readonly previews: DiscordInvitePreviewProvider
  ) {}

  async execute(input: GetDiscordPreviewInput): Promise<GetDiscordPreviewOutput> {
    const { room, isMember } = await resolveAccessibleRoom(
      this.rooms,
      this.members,
      this.clock,
      input
    )

    // A non-member of an Open Squad cannot tell it from a missing one, as on every other lobby detail.
    if (!isMember) throw new RoomNotFoundError(input.code)
    if (!room.readyAt) throw new RoomNotReadyError(room.id)

    const inviteCode = room.discordLink ? discordInviteCode(room.discordLink) : null
    if (!inviteCode) return { preview: null }

    const outcome = await this.previews.fetch(inviteCode)
    return { preview: outcome.kind === 'found' ? outcome.preview : null }
  }
}
