// `zod/mini` keeps the same contracts as the classic build while letting the
// bundler drop every schema the route validation does not use.
import * as z from 'zod/mini'

export const roomsSearchSchema = z.object({
  search: z.optional(z.string()),
  filter: z.optional(z.enum(['all', 'has-space', 'almost-full'])),
  sort: z.optional(z.enum(['newest', 'oldest'])),
  language: z.optional(z.enum(['all', 'pt-br', 'en'])),
  tag: z.optional(z.string()),
  page: z.optional(z.coerce.number().check(z.int(), z.gte(1))),
  join: z.optional(z.string()),
})
