import { z } from 'zod'
import { isoDateTimeSchema } from './date'

export const gameGenreSchema = z.object({
  slug: z.string(),
  name: z.string(),
})

export type GameGenreDto = z.infer<typeof gameGenreSchema>

// Game schema
export const gameSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  genres: z.array(gameGenreSchema),
  coverUrl: z.url(),
  coverThumbUrl: z.url(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type GameDto = z.infer<typeof gameSchema>

// Game summary carried by every Squad: enough to render the game next to it
// without a second read.
export const gameSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  genres: z.array(gameGenreSchema),
  coverUrl: z.url(),
  coverThumbUrl: z.url(),
})

export type GameSummaryDto = z.infer<typeof gameSummarySchema>

export const gameIdParamSchema = z.object({ id: z.string().uuid() })

// Game search query: a trimmed term and a page of Listed Games. An empty
// `search` behaves like no search; Fastify delivers query values as strings.
export const gamesQuerySchema = z.object({
  search: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type GamesQuery = z.infer<typeof gamesQuerySchema>

// Game HTTP responses
export const gamesResponseSchema = z.object({ games: z.array(gameSchema) })

export type GamesResponse = z.infer<typeof gamesResponseSchema>

export const gameResponseSchema = z.object({ game: gameSchema })
