/** What kind of channel an invite points to; Discord's own type numbers stay in infrastructure. */
export type DiscordChannelKind = 'voice' | 'stage' | 'other'

/** The channel an invite takes the person to. */
export interface DiscordInviteChannel {
  readonly id: string
  readonly name: string
  readonly kind: DiscordChannelKind
}

/** The Discord server behind an invite, as far as the Lobby and the create form show it. */
export interface DiscordServerPreview {
  readonly name: string
  readonly iconUrl: string | null
  /** The server's banner, or its invite splash, as a static image. */
  readonly backdropUrl: string | null
  readonly memberCount: number | null
  readonly onlineCount: number | null
  /** The invite's target channel, or `null` when Discord named none or named one this app cannot read. */
  readonly channel: DiscordInviteChannel | null
  /** When the invite stops working, as Discord states it, or `null` for an invite that never expires. */
  readonly expiresAt: string | null
}

/**
 * What asking about an invite came to. Only `found` carries a server; the others say why there is none,
 * so a cache can keep each for as long as it deserves.
 */
export type DiscordInvitePreviewOutcome =
  | { readonly kind: 'found'; readonly preview: DiscordServerPreview }
  /** The invite is unknown or expired. */
  | { readonly kind: 'invalid' }
  /** `retryAfterMs` is how long Discord asked to wait, when it said so. */
  | { readonly kind: 'rate_limited'; readonly retryAfterMs?: number }
  /** Discord was slow, down, or answered something this app cannot read. */
  | { readonly kind: 'unreachable' }

/** Source of the public data Discord holds for an invite code. */
export interface DiscordInvitePreviewProvider {
  /** Never rejects: every failure is an outcome. */
  fetch(inviteCode: string): Promise<DiscordInvitePreviewOutcome>
}
