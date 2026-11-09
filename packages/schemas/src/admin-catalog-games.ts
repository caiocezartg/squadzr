import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { adminSquadSchema } from './admin-squads'
import { gameGenreSchema } from './game'
import { pageQuerySchema, paginatedResponseSchema } from './pagination'
import { platformSchema } from './platform'

// The read-only Games view of the admin Catalog (#122): the games the catalog holds, listed or not, with
// how much each one is used. Editing a game is a later ticket.

// The longest search term of the admin Games list, after the trim; the panel's field is limited to the
// same length.
export const ADMIN_GAME_SEARCH_MAX_LENGTH = 100

/**
 * Which games the list keeps. Absent is `all`. `featured` is a Listed Game with a featured rank: the
 * hand-picked highlights players see, which is also what the summary counts.
 */
export const ADMIN_GAME_STATUSES = ['all', 'listed', 'delisted', 'featured'] as const

export const adminGameStatusSchema = z.enum(ADMIN_GAME_STATUSES)

export type AdminGameStatus = z.infer<typeof adminGameStatusSchema>

/**
 * How the list is ordered. Absent is `popularity` (highest first). `newest` is by creation,
 * `openSquads` and `completedSquads` are most used first, `name` is A to Z. Every order ends on the
 * game id, so a page never repeats or skips a row.
 */
export const ADMIN_GAME_SORTS = [
  'popularity',
  'name',
  'newest',
  'openSquads',
  'completedSquads',
] as const

export const adminGameSortSchema = z.enum(ADMIN_GAME_SORTS)

export type AdminGameSort = z.infer<typeof adminGameSortSchema>

function emptyAsAbsent<T extends z.ZodType>(schema: T) {
  return z.union([z.literal('').transform(() => undefined), schema]).optional()
}

// Query values arrive as strings: a blank search or an empty filter means "no filter". `q` matches the
// name or an alias, ignoring case, accents and punctuation.
export const adminGamesQuerySchema = pageQuerySchema.extend({
  q: z
    .string()
    .trim()
    .max(ADMIN_GAME_SEARCH_MAX_LENGTH)
    .transform((value) => (value === '' ? undefined : value))
    .optional(),
  status: emptyAsAbsent(adminGameStatusSchema),
  sort: emptyAsAbsent(adminGameSortSchema),
})

export type AdminGamesQuery = z.infer<typeof adminGamesQuerySchema>

export const adminGameIdParamSchema = z.object({ id: z.uuid() })

const countSchema = z.number().int().nonnegative()

// How a game is used: its Open Squads right now and every Squad that became Ready for it, all time.
export const adminGameUsageSchema = z.object({
  openSquads: countSchema,
  completedSquads: countSchema,
})

export type AdminGameUsageDto = z.infer<typeof adminGameUsageSchema>

// One row of the Games list.
export const adminGameSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  coverThumbUrl: z.url(),
  platforms: z.array(platformSchema),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  popularity: z.number().int(),
  featuredRank: z.number().int().nullable(),
  listed: z.boolean(),
  usage: adminGameUsageSchema,
})

export type AdminGameDto = z.infer<typeof adminGameSchema>

export const adminGamesResponseSchema = paginatedResponseSchema(adminGameSchema)

export type AdminGamesResponse = z.infer<typeof adminGamesResponseSchema>

// The detail page: every field of the game, never editable here. `aliases` are as the catalog stores
// them (already normalized).
export const adminGameDetailSchema = adminGameSchema.extend({
  igdbId: z.number().int().nullable(),
  genres: z.array(gameGenreSchema),
  aliases: z.array(z.string()),
  coverUrl: z.url(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type AdminGameDetailDto = z.infer<typeof adminGameDetailSchema>

/** How many Open Squads the detail lists; `game.usage.openSquads` is the real count. */
export const ADMIN_GAME_OPEN_SQUADS_LIMIT = 20

// The game and its newest Open Squads (at most `ADMIN_GAME_OPEN_SQUADS_LIMIT`), in the admin Squads
// list's row shape.
export const adminGameDetailResponseSchema = z.object({
  game: adminGameDetailSchema,
  openSquads: z.array(adminSquadSchema),
})

export type AdminGameDetailResponse = z.infer<typeof adminGameDetailResponseSchema>

/** How many names a summary list carries; `total` is the real count. */
export const ADMIN_GAME_CHANGE_NAMES_LIMIT = 5

// The games that entered or left the catalog in a run: how many, and the first few by name.
export const adminGameChangeSchema = z.object({
  total: countSchema,
  games: z.array(z.object({ id: z.uuid(), name: z.string() })),
})

export type AdminGameChangeDto = z.infer<typeof adminGameChangeSchema>

// The Games tab's header. `lastImport` is the most recent succeeded Catalog Import Run, with the games
// created (`entered`) and delisted (`left`) inside its started-to-finished window; null before any run
// succeeded.
export const adminGamesSummarySchema = z.object({
  listed: countSchema,
  delisted: countSchema,
  featured: countSchema,
  lastImport: z
    .object({
      runId: z.string(),
      finishedAt: isoDateTimeSchema,
      entered: adminGameChangeSchema,
      left: adminGameChangeSchema,
    })
    .nullable(),
})

export type AdminGamesSummaryDto = z.infer<typeof adminGamesSummarySchema>
