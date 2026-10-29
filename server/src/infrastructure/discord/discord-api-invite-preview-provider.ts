import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import { discordInviteResponseSchema, type DiscordInviteResponse } from './discord-invite.schemas'

const INVITES_URL = 'https://discord.com/api/v10/invites'
const CDN_URL = 'https://cdn.discordapp.com'
const DEFAULT_TIMEOUT_MS = 3_000
const ICON_SIZE = 128
const BACKDROP_SIZE = 480

/** The part of `fetch` this provider uses, which a test can stand in for. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

type Guild = NonNullable<DiscordInviteResponse['guild']>

export interface DiscordApiInvitePreviewOptions {
  readonly fetchImpl?: FetchLike
  readonly timeoutMs?: number
}

/**
 * Reads an invite's server from Discord's public invite endpoint, which needs no credentials. A request
 * that takes longer than the timeout is abandoned, and nothing Discord does makes this reject.
 */
export class DiscordApiInvitePreviewProvider implements DiscordInvitePreviewProvider {
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number

  constructor(options: DiscordApiInvitePreviewOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  async fetch(inviteCode: string): Promise<DiscordInvitePreviewOutcome> {
    try {
      const response = await this.fetchImpl(
        `${INVITES_URL}/${encodeURIComponent(inviteCode)}?with_counts=true`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) }
      )

      if (response.status === 404) return { kind: 'invalid' }
      if (response.status === 429) return { kind: 'rate_limited' }
      if (!response.ok) return { kind: 'unreachable' }

      return toOutcome(discordInviteResponseSchema.safeParse(await response.json()))
    } catch {
      // A timeout, a network failure or a body that is not JSON.
      return { kind: 'unreachable' }
    }
  }
}

function toOutcome(
  parsed: ReturnType<typeof discordInviteResponseSchema.safeParse>
): DiscordInvitePreviewOutcome {
  if (!parsed.success) return { kind: 'unreachable' }

  const { guild } = parsed.data
  // An invite with no server behind it (a group DM, say) has nothing to preview.
  if (!guild) return { kind: 'invalid' }

  return {
    kind: 'found',
    preview: {
      name: guild.name,
      iconUrl: iconUrl(guild),
      backdropUrl: backdropUrl(guild),
      memberCount: parsed.data.approximate_member_count ?? null,
      onlineCount: parsed.data.approximate_presence_count ?? null,
    },
  }
}

/** An animated icon (hash starting `a_`) is a GIF, any other a PNG. */
function iconUrl(guild: Guild): string | null {
  if (!guild.icon) return null
  const extension = guild.icon.startsWith('a_') ? 'gif' : 'png'
  return `${CDN_URL}/icons/${guild.id}/${guild.icon}.${extension}?size=${ICON_SIZE}`
}

/** Always a still PNG: an animated banner is megabytes, and the backdrop sits dim behind the card. */
function backdropUrl(guild: Guild): string | null {
  if (guild.banner) {
    return `${CDN_URL}/banners/${guild.id}/${guild.banner}.png?size=${BACKDROP_SIZE}`
  }
  if (guild.splash) {
    return `${CDN_URL}/splashes/${guild.id}/${guild.splash}.png?size=${BACKDROP_SIZE}`
  }
  return null
}
