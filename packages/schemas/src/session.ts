import { z } from 'zod'
import { userRoleSchema } from './admin'

// The part of Better Auth's session the app reads: the viewer's user. The rest of the response
// (the session row, timestamps, flags) is stripped on parse.
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
    // Required: a session without a role is a broken response, never a plain user.
    role: userRoleSchema,
  }),
})

// Better Auth answers a missing or expired session with `200` and a `null` body.
export const sessionResponseSchema = sessionSchema.nullable()

export type SessionDto = z.infer<typeof sessionSchema>
