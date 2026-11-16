import { z } from 'zod'
import type {
  DiscordChannelKind,
  DiscordInviteChannel,
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import {
  discordInviteResponseSchema,
  discordRateLimitResponseSchema,
  type DiscordInviteResponse,
} from './discord-invite.schemas'

const INVITES_URL = 'https://discord.com/api/v10/invites'
const CDN_URL = 'https://cdn.discordapp.com'
const DEFAULT_TIMEOUT_MS = 3_000
/** The longest `retry_after` worth waiting out inside one lookup; a longer one is the caller's to retry. */
const MAX_RETRY_WAIT_MS = 2_000
const ICON_SIZE = 128
const BACKDROP_SIZE = 480

/** Discord's channel types for a voice channel and a stage channel. */
const VOICE_CHANNEL_TYPE = 2
const STAGE_CHANNEL_TYPE = 13

/** The part of `fetch` this provider uses, which a test can stand in for. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/** Waits for the given milliseconds; a test stands in for it so no spec really sleeps. */
export type Sleep = (ms: number) => Promise<void>

/** The part of a logger this provider uses; Fastify's logger fits. */
export interface DiscordLookupLogger {
  warn(details: Record<string, unknown>, message: string): void
}

type Guild = NonNullable<DiscordInviteResponse['guild']>

export interface DiscordApiInvitePreviewOptions {
  readonly fetchImpl?: FetchLike
  readonly timeoutMs?: number
  /**
   * The token of a Discord application's bot. Set, the lookup is sent as `Authorization: Bot <token>` and
   * Discord rate-limits the application instead of this server's address. Unset, it carries no credentials.
   */
  readonly botToken?: string
  readonly sleep?: Sleep
  readonly logger?: DiscordLookupLogger
}

/** A `Retry-After` header in seconds: a plain non-negative decimal, not hex, exponent or `Infinity`. */
const retryAfterHeaderSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .transform(Number)
  .pipe(z.number().nonnegative().finite())

const sleepFor: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Reads an invite's server and target channel from Discord's invite endpoint. A request that takes longer
 * than the timeout is abandoned, a short rate limit is waited out once, and nothing Discord does makes this
 * reject. The token never reaches a log line, an outcome or an error.
 */
export class DiscordApiInvitePreviewProvider implements DiscordInvitePreviewProvider {
  private readonly fetchImpl: FetchLike
  private readonly timeoutMs: number
  private readonly botToken: string | undefined
  private readonly sleep: Sleep
  private readonly logger: DiscordLookupLogger | undefined

  constructor(options: DiscordApiInvitePreviewOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.botToken = options.botToken
    this.sleep = options.sleep ?? sleepFor
    this.logger = options.logger
  }

  async fetch(inviteCode: string): Promise<DiscordInvitePreviewOutcome> {
    const outcome = await this.lookup(inviteCode)
    this.logOutage(inviteCode, outcome)
    return outcome
  }

  private async lookup(inviteCode: string): Promise<DiscordInvitePreviewOutcome> {
    try {
      let response = await this.request(inviteCode)

      if (response.status === 429) {
        const retryAfterMs = await retryAfterOf(response)
        if (retryAfterMs === undefined || retryAfterMs > MAX_RETRY_WAIT_MS) {
          return rateLimited(retryAfterMs)
        }

        await this.sleep(retryAfterMs)
        response = await this.request(inviteCode)
        if (response.status === 429) return rateLimited(await retryAfterOf(response))
      }

      return await toOutcome(response)
    } catch {
      // A timeout, a network failure or a body that is not JSON.
      return { kind: 'unreachable' }
    }
  }

  private request(inviteCode: string): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (this.botToken) headers['Authorization'] = `Bot ${this.botToken}`

    return this.fetchImpl(
      `${INVITES_URL}/${encodeURIComponent(inviteCode)}?with_counts=true&with_expiration=true`,
      { headers, signal: AbortSignal.timeout(this.timeoutMs) }
    )
  }

  /** Every answer that blocks creating a Squad is logged, so production tells whether 429s really happen. */
  private logOutage(inviteCode: string, outcome: DiscordInvitePreviewOutcome): void {
    if (outcome.kind !== 'rate_limited' && outcome.kind !== 'unreachable') return

    this.logger?.warn(
      {
        inviteCode,
        outcome: outcome.kind,
        retryAfterMs: outcome.kind === 'rate_limited' ? (outcome.retryAfterMs ?? null) : null,
        // The status is safe to log and tells a rejected token (401, 403) from an outage.
        status: outcome.kind === 'unreachable' ? (outcome.status ?? null) : null,
      },
      `Discord invite lookup was ${outcome.kind}`
    )
  }
}

function rateLimited(retryAfterMs: number | undefined): DiscordInvitePreviewOutcome {
  return retryAfterMs === undefined
    ? { kind: 'rate_limited' }
    : { kind: 'rate_limited', retryAfterMs }
}

async function toOutcome(response: Response): Promise<DiscordInvitePreviewOutcome> {
  if (response.status === 404) return { kind: 'invalid' }
  if (!response.ok) return { kind: 'unreachable', status: response.status }

  const parsed = discordInviteResponseSchema.safeParse(await response.json())
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
      expiresAt: parsed.data.expires_at ?? null,
      channel: toChannel(parsed.data.channel),
    },
  }
}

function toChannel(channel: DiscordInviteResponse['channel']): DiscordInviteChannel | null {
  if (!channel) return null
  return { id: channel.id, name: channel.name, kind: channelKind(channel.type) }
}

/** Discord's type numbers end here: the domain only knows voice, stage and other. */
function channelKind(type: number): DiscordChannelKind {
  if (type === VOICE_CHANNEL_TYPE) return 'voice'
  if (type === STAGE_CHANNEL_TYPE) return 'stage'
  return 'other'
}

/** How long Discord asked to wait, from the 429 body or else the `Retry-After` header, in milliseconds. */
async function retryAfterOf(response: Response): Promise<number | undefined> {
  const seconds = (await bodyRetryAfter(response)) ?? headerRetryAfter(response)
  // At least 1 ms: the 503 contract (`retryAfterMs`) is a positive integer, and Discord may answer 0.
  return seconds === undefined ? undefined : Math.max(1, Math.ceil(seconds * 1000))
}

async function bodyRetryAfter(response: Response): Promise<number | undefined> {
  try {
    const body = discordRateLimitResponseSchema.safeParse(await response.json())
    return body.success ? body.data.retry_after : undefined
  } catch {
    return undefined
  }
}

function headerRetryAfter(response: Response): number | undefined {
  const header = response.headers.get('Retry-After')?.trim()
  const parsed = retryAfterHeaderSchema.safeParse(header)
  return parsed.success ? parsed.data : undefined
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
