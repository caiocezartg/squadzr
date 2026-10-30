/** The Discord server behind an invite, as far as the Lobby shows it. */
export interface DiscordServerPreview {
  readonly name: string
  readonly iconUrl: string | null
  /** The server's banner, or its invite splash, as a static image. */
  readonly backdropUrl: string | null
  readonly memberCount: number | null
  readonly onlineCount: number | null
}

/**
 * What asking about an invite came to. Only `found` carries a server; the others say why there is none,
 * so a cache can keep each for as long as it deserves.
 */
export type DiscordInvitePreviewOutcome =
  | { readonly kind: 'found'; readonly preview: DiscordServerPreview }
  /** The invite is unknown or expired. */
  | { readonly kind: 'invalid' }
  | { readonly kind: 'rate_limited' }
  /** Discord was slow, down, or answered something this app cannot read. */
  | { readonly kind: 'unreachable' }

/** Source of the public data Discord holds for an invite code. */
export interface DiscordInvitePreviewProvider {
  /** Never rejects: every failure is an outcome. */
  fetch(inviteCode: string): Promise<DiscordInvitePreviewOutcome>
}
