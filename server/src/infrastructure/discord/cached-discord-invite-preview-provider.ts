import type {
  DiscordInvitePreviewOutcome,
  DiscordInvitePreviewProvider,
} from '@domain/services/discord-invite-preview-provider.interface'
import type { Clock } from '@domain/services/clock.interface'

/** How long an answer, a negative one included, keeps Discord from being asked again. */
const DEFAULT_TTL_MS = 10 * 60_000
/** An invite Discord does not know is asked again sooner: its creator may be about to make it. */
const DEFAULT_SHORT_TTL_MS = 60_000
/**
 * A Discord that was slow, down or rate limiting blocks creating a Squad, so it is asked again within
 * seconds. It is also the longest a rate-limited answer is kept, whatever wait Discord asked for.
 */
const DEFAULT_OUTAGE_TTL_MS = 10_000
const DEFAULT_MAX_ENTRIES = 500

export interface CachedDiscordInvitePreviewOptions {
  readonly ttlMs?: number
  readonly shortTtlMs?: number
  readonly outageTtlMs?: number
  readonly maxEntries?: number
}

interface Entry {
  readonly outcome: Promise<DiscordInvitePreviewOutcome>
  /** Unset while the request is in flight: callers that arrive meanwhile share it. */
  expiresAt: number | null
}

/**
 * Remembers what Discord said about each invite code so a popular Lobby never makes Discord hear from it
 * more than once per window: ten minutes for an invite found, a minute for one Discord does not know, and
 * ten seconds when Discord was unreachable. A rate-limited answer is kept for the wait Discord asked for,
 * at most ten seconds, and for ten seconds when it asked for none. It lives in memory, per process, and
 * holds at most `maxEntries` codes.
 */
export class CachedDiscordInvitePreviewProvider implements DiscordInvitePreviewProvider {
  private readonly entries = new Map<string, Entry>()
  private readonly ttlMs: number
  private readonly shortTtlMs: number
  private readonly outageTtlMs: number
  private readonly maxEntries: number

  constructor(
    private readonly inner: DiscordInvitePreviewProvider,
    private readonly clock: Clock,
    options: CachedDiscordInvitePreviewOptions = {}
  ) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    this.shortTtlMs = options.shortTtlMs ?? DEFAULT_SHORT_TTL_MS
    this.outageTtlMs = options.outageTtlMs ?? DEFAULT_OUTAGE_TTL_MS
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES
  }

  fetch(inviteCode: string): Promise<DiscordInvitePreviewOutcome> {
    const cached = this.entries.get(inviteCode)
    if (cached && (cached.expiresAt === null || cached.expiresAt > this.clock.now().getTime())) {
      return cached.outcome
    }

    const entry: Entry = { outcome: this.fetchInner(inviteCode), expiresAt: null }
    this.entries.set(inviteCode, entry)
    void entry.outcome.then((outcome) => {
      entry.expiresAt = this.clock.now().getTime() + this.ttlFor(outcome)
      this.evict()
    })
    return entry.outcome
  }

  /** A rejection becomes `unreachable`, so it is kept for the outage window and not for good. */
  private async fetchInner(inviteCode: string): Promise<DiscordInvitePreviewOutcome> {
    try {
      return await this.inner.fetch(inviteCode)
    } catch {
      return { kind: 'unreachable' }
    }
  }

  private ttlFor(outcome: DiscordInvitePreviewOutcome): number {
    switch (outcome.kind) {
      case 'found':
        return this.ttlMs
      case 'invalid':
        return this.shortTtlMs
      case 'unreachable':
        return this.outageTtlMs
      case 'rate_limited':
        return Math.min(outcome.retryAfterMs ?? this.outageTtlMs, this.outageTtlMs)
    }
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
