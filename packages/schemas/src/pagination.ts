import { z } from 'zod'

// The shared pagination contract of every paginated list: a 1-based `page` query and a response that
// carries the page, the fixed size and the real total. A page past the end answers empty `items`
// with the real `total`, never an error.
export const PAGE_SIZE = 20

// An upper bound only so an absurd page cannot overflow the database offset; no list comes close.
const MAX_PAGE = 1_000_000

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
})

export type PageQuery = z.infer<typeof pageQuerySchema>

export function paginatedResponseSchema<Item extends z.ZodType>(item: Item) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.literal(PAGE_SIZE),
    total: z.number().int().nonnegative(),
  })
}

export type PaginatedResponse<Item> = {
  readonly items: readonly Item[]
  readonly page: number
  readonly pageSize: typeof PAGE_SIZE
  readonly total: number
}
