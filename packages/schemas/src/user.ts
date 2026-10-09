import { z } from 'zod'
import { isoDateTimeSchema } from './date'

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
