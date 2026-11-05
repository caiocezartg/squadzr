import { z } from 'zod'
import { isoDateTimeSchema } from './date'
import { gameSummarySchema } from './game'

// User schema
export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  image: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type UserDto = z.infer<typeof userSchema>

export const userResponseSchema = z.object({ user: userSchema })

// Player Profile: what anyone may read about a person. It is public, so it never carries
// the email, the verification flag, the Discord id or the list of Squads they played.
export const PROFILE_TOP_GAMES_LIMIT = 5

export const profileGameSchema = gameSummarySchema.pick({
  id: true,
  name: true,
  slug: true,
  coverUrl: true,
  coverThumbUrl: true,
})

export type ProfileGameDto = z.infer<typeof profileGameSchema>

export const playerProfileParamsSchema = z.object({ id: z.string().min(1).max(255) })

export const playerProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
  memberSince: isoDateTimeSchema,
  completedSquads: z.number().int().nonnegative(),
  gamesPlayed: z.number().int().nonnegative(),
  lastSquad: z.object({ game: profileGameSchema, readyAt: isoDateTimeSchema }).nullable(),
  topGames: z
    .array(z.object({ game: profileGameSchema, squads: z.number().int().positive() }))
    .max(PROFILE_TOP_GAMES_LIMIT),
})

export type PlayerProfileDto = z.infer<typeof playerProfileSchema>

export const playerProfileResponseSchema = z.object({ profile: playerProfileSchema })

export type PlayerProfileResponse = z.infer<typeof playerProfileResponseSchema>
