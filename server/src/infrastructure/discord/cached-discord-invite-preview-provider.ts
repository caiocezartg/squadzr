import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import type { Clock } from '@domain/services/clock.interface'

/** How long an answer, a negative one included, keeps Discord from being asked again. */
const DEFAULT_TTL_MS = 10 * 60_000
/**
 * A Discord that was slow or down is asked again sooner, since the outage is not the invite's fault, and so
 * is an invite Discord does not know: its creator may be about to make it.
 */
const DEFAULT_SHORT_TTL_MS = 60_000
const DEFAULT_MAX_ENTRIES = 500

export interface CachedDiscordInvitePreviewOptions {
  readonly ttlMs?: number
  readonly shortTtlMs?: number
  readonly maxEntries?: number
}

interface Entry {
  readonly outcome: Promise<DiscordInvitePreviewOutcome>
  /** Unset while the request is in flight: callers that arrive meanwhile share it. */
  expiresAt: number | null
}

/**
 * Remembers what Discord said about each invite code for ten minutes, a rate-limited answer included, and
 * for a minute when the invite is unknown or Discord was unreachable, so a popular Lobby never makes Discord
 * hear from it more than once per window. It lives in memory, per process, and holds at most `maxEntries`
 * codes.
 */
export class CachedDiscordInvitePreviewProvider implements DiscordInvitePreviewProvider {
  private readonly entries = new Map<string, Entry>()
  private readonly ttlMs: number
  private readonly shortTtlMs: number
  private readonly maxEntries: number

  constructor(
    private readonly inner: DiscordInvitePreviewProvider,
    private readonly clock: Clock,
    options: CachedDiscordInvitePreviewOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.shortTtlMs = options.shortTtlMs ?? DEFAULT_SHORT_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  }

  fetch(inviteCode: string): Promise<DiscordInvitePreviewOutcome> {
    const cached = this.entries.get(inviteCode)
    if (cached && (cached.expiresAt === null || cached.expiresAt > this.clock.now().getTime())) {
      return cached.outcome
    }

    const entry: Entry = { outcome: this.inner.fetch(inviteCode), expiresAt: null }
    this.entries.set(inviteCode, entry)
    void entry.outcome.then((outcome) => {
      entry.expiresAt = this.clock.now().getTime() + this.ttlFor(outcome)
      this.evict()
    })
    return entry.outcome
  }

  private ttlFor(outcome: DiscordInvitePreviewOutcome): number {
    return outcome.kind === 'unreachable' || outcome.kind === 'invalid'
      ? this.shortTtlMs
      : this.ttlMs
  }

  /** Drops expired answers first and then the oldest, so the map cannot grow with every code seen. */
  private evict(): void {
    if (this.entries.size <= this.maxEntries) return

    const now = this.clock.now().getTime()
    for (const [code, entry] of this.entries) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) this.entries.delete(code)
    }
    for (const code of this.entries.keys()) {
      if (this.entries.size <= this.maxEntries) return
      this.entries.delete(code)
    }
  }
}
