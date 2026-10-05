import { z } from 'zod'

export const roomsSearchSchema = z.object({
  search: z.string().optional(),
  filter: z.enum(['all', 'has-space', 'almost-full']).optional(),
  sort: z.enum(['newest', 'oldest']).optional(),
  language: z.enum(['all', 'pt-br', 'en']).optional(),
  tag: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  join: z.string().optional(),
})
