/** The addresses a Discord invite starts with: the same rule the contract applies when a Squad is created. */
const INVITE_PREFIXES = ['https://discord.gg/', 'https://discord.com/invite/'] as const

export interface DiscordInviteLink {
  /** The invite as the Squad carries it, for the link and the clipboard. */
  readonly href: string
  /** What the row dims: the host and path before the invite's own code, without the scheme. */
  readonly host: string
  /** The invite's own code, which the row brightens. */
  readonly code: string
}

/**
 * The invite when the link is a valid Discord invite URL, and `null` otherwise. Only a valid invite ever
 * renders as a link or reaches the clipboard, so a Squad carrying anything else shows no invite at all.
 */
export function parseDiscordInvite(link: string): DiscordInviteLink | null {
  const prefix = INVITE_PREFIXES.find((candidate) => link.startsWith(candidate))
  if (!prefix) return null

  return { href: link, host: prefix.slice('https://'.length), code: link.slice(prefix.length) }
}
