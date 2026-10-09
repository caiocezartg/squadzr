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

export const gameIdParamSchema = z.object({ id: z.string().uuid() })

// Game HTTP responses
export const gamesResponseSchema = z.object({ games: z.array(gameSchema) })

export type GamesResponse = z.infer<typeof gamesResponseSchema>

export const gameResponseSchema = z.object({ game: gameSchema })
