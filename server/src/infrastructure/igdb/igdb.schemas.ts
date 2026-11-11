import { z } from 'zod'

/**
 * The Twitch client-credentials response. Only the token is used and it never
 * leaves the adapter; `expires_in` is validated when present so a malformed
 * response fails the run instead of producing an unusable Authorization header.
 */
export const igdbTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive().optional(),
  token_type: z.string().optional(),
})

export type IgdbTokenResponse = z.infer<typeof igdbTokenResponseSchema>

const igdbCoverSchema = z.object({
  image_id: z.string().min(1),
})

const igdbGenreSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
})

const igdbAlternativeNameSchema = z.object({
  name: z.string().nullable().optional(),
})

const igdbMultiplayerModeSchema = z.object({
  onlinecoopmax: z.number().int().nonnegative().nullable().optional(),
  onlinemax: z.number().int().nonnegative().nullable().optional(),
})

/**
 * One game of a games page. `name`, `slug` and `cover` stay optional because
 * IGDB can omit them: the adapter drops those candidates and counts them, which
 * is a candidate-level decision, not a malformed page.
 */
export const igdbGameSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().nullable().optional(),
  slug: z.string().nullable().optional(),
  cover: igdbCoverSchema.nullable().optional(),
  genres: z.array(igdbGenreSchema).nullable().optional(),
  // Platform ids (not expanded): the adapter keeps the ones the Platform enum maps.
  platforms: z.array(z.number().int().positive()).nullable().optional(),
  // Acronyms, abbreviations and regional titles; the adapter keeps the non-blank names.
  alternative_names: z.array(igdbAlternativeNameSchema).nullable().optional(),
  multiplayer_modes: z.array(igdbMultiplayerModeSchema).nullable().optional(),
  first_release_date: z.number().int().nullable().optional(),
  total_rating_count: z.number().int().nonnegative().nullable().optional(),
})

export type IgdbGame = z.infer<typeof igdbGameSchema>

/** The whole page must be an array; a malformed entry fails the run. */
export const igdbGamesPageSchema = z.array(igdbGameSchema)

/**
 * One `popularity_primitives` row. `value` can be a decimal (Playing is an
 * average), so it is not constrained to an integer.
 */
export const igdbPopularityPrimitiveSchema = z.object({
  game_id: z.number().int().positive(),
  popularity_type: z.number().int(),
  value: z.number().nonnegative(),
})

export type IgdbPopularityPrimitive = z.infer<typeof igdbPopularityPrimitiveSchema>

export const igdbPopularityPrimitivesPageSchema = z.array(igdbPopularityPrimitiveSchema)
