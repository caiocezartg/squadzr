import { z } from 'zod'

/** Discord's ids are decimal snowflakes and its image hashes are lowercase hex, optionally `a_`-prefixed. */
const snowflake = z.string().regex(/^\d{1,32}$/)
const imageHash = z.string().regex(/^(a_)?[0-9a-f]{1,64}$/)

/**
 * The channel an invite points to. Read leniently: a channel that is missing or not shaped as Discord
 * documents becomes `null`, never a parse failure, since a failed parse reads as an
 * unreachable Discord and that blocks creating a Squad.
 */
const inviteChannel = z
  .object({
    id: snowflake,
    // Discord's own limit for a channel name.
    name: z.string().min(1).max(100),
    type: z.number().int(),
  })
  .nullish()
  .catch(null)

/** The parts of Discord's `GET /invites/{code}?with_counts=true&with_expiration=true` answer this app reads. */
export const discordInviteResponseSchema = z.object({
  guild: z
    .object({
      id: snowflake,
      name: z.string(),
      icon: imageHash.nullish(),
      banner: imageHash.nullish(),
      splash: imageHash.nullish(),
    })
    .optional(),
  channel: inviteChannel,
  approximate_member_count: z.number().int().nonnegative().optional(),
  approximate_presence_count: z.number().int().nonnegative().optional(),
  expires_at: z.string().nullish(),
})

export type DiscordInviteResponse = z.infer<typeof discordInviteResponseSchema>

/** What Discord's 429 body carries: how long to wait, in seconds (fractions allowed). */
export const discordRateLimitResponseSchema = z.object({
  retry_after: z.number().nonnegative().finite(),
})
