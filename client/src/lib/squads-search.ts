import { z } from 'zod'

export const squadsSearchSchema = z.object({
  search: z.string().optional(),
  language: z.enum(['all', 'pt-br', 'en']).optional(),
  tag: z.string().optional(),
  capacity: z.enum(['all', 'almost-full']).optional(),
  sort: z.enum(['newest', 'expires-soon']).optional(),
})
