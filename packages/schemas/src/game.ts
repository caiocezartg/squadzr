import { z } from 'zod'
import { isoDateTimeSchema } from './date'

// Game schema
export const gameSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  coverUrl: z.url(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type GameDto = z.infer<typeof gameSchema>

// Game summary carried by every Squad: enough to render the game next to it
// without a second read.
export const gameGenreSchema = z.object({ slug: z.string(), name: z.string() })

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

// Game HTTP responses
export const gamesResponseSchema = z.object({ games: z.array(gameSchema) })

export type GamesResponse = z.infer<typeof gamesResponseSchema>

export const gameResponseSchema = z.object({ game: gameSchema })
