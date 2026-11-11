import { z } from 'zod'

/** Discord's ids are decimal snowflakes and its image hashes are lowercase hex, optionally `a_`-prefixed. */
const snowflake = z.string().regex(/^\d{1,32}$/)
const imageHash = z.string().regex(/^(a_)?[0-9a-f]{1,64}$/)

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
  approximate_member_count: z.number().int().nonnegative().optional(),
  approximate_presence_count: z.number().int().nonnegative().optional(),
  expires_at: z.string().nullish(),
})

export type DiscordInviteResponse = z.infer<typeof discordInviteResponseSchema>
