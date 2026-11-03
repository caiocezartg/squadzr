import { z } from 'zod'

// The addresses a Discord invite starts with: the one rule the contract applies when a Squad is created
// and the server and the client apply when they read an invite.
export const DISCORD_INVITE_PREFIXES = [
  'https://discord.gg/',
  'https://discord.com/invite/',
] as const

export interface DiscordInviteLink {
  // The invite as the Squad carries it, for the link and the clipboard.
  readonly href: string
  // What a row dims: the host and path before the invite's own code, without the scheme.
  readonly host: string
  // The invite's own code, which a row brightens.
  readonly code: string
}

// The invite when the link is a valid Discord invite URL with a code after its host, and `null`
// otherwise.
export function parseDiscordInvite(link: string): DiscordInviteLink | null {
  const prefix = DISCORD_INVITE_PREFIXES.find((candidate) => link.startsWith(candidate))
  if (!prefix) return null

  // An address with no invite code after the host opens no invite, so it is no invite at all.
  const code = link.slice(prefix.length)
  if (code === '') return null

  return { href: link, host: prefix.slice('https://'.length), code }
}

// What Discord accepts as an invite code: letters, digits and hyphens.
const INVITE_CODE = /^[A-Za-z0-9-]{1,64}$/

// The invite code on its own, as a request path carries it. One rule for the endpoint that checks an
// invite and for the contract that reads it out of a link.
export const discordInviteCodeParamSchema = z.object({
  code: z.string().regex(INVITE_CODE),
})

// The code to ask Discord about, or `null` when the link is no invite or its code is not safe to put in
// a request path. A query string or a trailing path after the code is dropped.
export function discordInviteCode(link: string): string | null {
  const invite = parseDiscordInvite(link)
  if (!invite) return null

  const code = invite.code.split(/[/?#]/, 1)[0] ?? ''
  return INVITE_CODE.test(code) ? code : null
}

// The Discord server behind a Ready Squad's invite, as Discord's public invite endpoint describes it.
export const discordServerPreviewSchema = z.object({
  name: z.string(),
  iconUrl: z.url().nullable(),
  // The server's banner, or its invite splash, as a static image to sit behind the card.
  backdropUrl: z.url().nullable(),
  memberCount: z.number().int().nonnegative().nullable(),
  onlineCount: z.number().int().nonnegative().nullable(),
})

export type DiscordServerPreviewDto = z.infer<typeof discordServerPreviewSchema>

// `preview` is `null` whenever Discord has nothing to show: the invite is invalid or expired, Discord is
// slow, down or rate limiting. The Lobby then falls back to the Squad's own data, so none of those is an
// error of this endpoint.
export const discordPreviewResponseSchema = z.object({
  preview: discordServerPreviewSchema.nullable(),
})

export type DiscordPreviewResponse = z.infer<typeof discordPreviewResponseSchema>

// Discord's own answer about an invite a Squad creator typed: `valid` carries the server behind it and
// whether the invite ever expires, `invalid` means Discord does not know it, and `unknown` means Discord
// could not be asked (slow, down or rate limiting), which is no verdict on the invite.
export const discordInviteCheckResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('valid'),
    server: z.object({
      name: z.string(),
      iconUrl: z.url().nullable(),
      memberCount: z.number().int().nonnegative().nullable(),
    }),
    expires: z.boolean(),
  }),
  z.object({ status: z.literal('invalid') }),
  z.object({ status: z.literal('unknown') }),
])

export type DiscordInviteCheckResponse = z.infer<typeof discordInviteCheckResponseSchema>
