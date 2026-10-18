import { z } from 'zod'

// The part of Better Auth's session the app reads: the viewer's user. The rest of the response
// (the session row, timestamps, flags) is stripped on parse.
export const sessionSchema = z.object({
  user: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
  }),
})

// Better Auth answers a missing or expired session with `200` and a `null` body.
export const sessionResponseSchema = sessionSchema.nullable()

export type SessionDto = z.infer<typeof sessionSchema>
