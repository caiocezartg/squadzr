// `zod/mini` keeps the same contracts as the classic build while letting the
// bundler drop every schema the route validation does not use.
import * as z from 'zod/mini'

const filterSchema = z.enum(['all', 'has-space', 'almost-full'])
const sortSchema = z.enum(['newest', 'oldest'])
const languageSchema = z.enum(['all', 'pt-br', 'en'])

export type RoomStatusFilter = z.infer<typeof filterSchema>
export type RoomSort = z.infer<typeof sortSchema>
export type RoomLanguageFilter = z.infer<typeof languageSchema>

/** An invalid parameter drops out of the result, so its default applies. */
function lenient<T extends z.ZodMiniType>(schema: T) {
  return z.catch(z.optional(schema), undefined)
}

/**
 * The URL search contract of the squad lists. Every parameter is parsed on its
 * own: an invalid one is dropped (its default applies) and every valid one is
 * kept, `join` included, so a bad board URL never throws.
 */
export const roomsSearchSchema = z.catch(
  z.object({
    search: lenient(z.string()),
    filter: lenient(filterSchema),
    sort: lenient(sortSchema),
    language: lenient(languageSchema),
    tag: lenient(z.string()),
    page: lenient(z.coerce.number().check(z.int(), z.gte(1))),
    join: lenient(z.string()),
  }),
  {}
)

export type RoomsSearch = z.infer<typeof roomsSearchSchema>

/** A search with every list parameter resolved to a value. */
export type ResolvedRoomsSearch = Required<Omit<RoomsSearch, 'join'>>

/** The search the lists show when the URL leaves a parameter out. */
export const ROOMS_SEARCH_DEFAULTS: ResolvedRoomsSearch = {
  search: '',
  filter: 'all',
  sort: 'newest',
  language: 'all',
  tag: '',
  page: 1,
}

export function resolveRoomsSearch(search: RoomsSearch): ResolvedRoomsSearch {
  return {
    search: search.search ?? ROOMS_SEARCH_DEFAULTS.search,
    filter: search.filter ?? ROOMS_SEARCH_DEFAULTS.filter,
    sort: search.sort ?? ROOMS_SEARCH_DEFAULTS.sort,
    language: search.language ?? ROOMS_SEARCH_DEFAULTS.language,
    tag: search.tag ?? ROOMS_SEARCH_DEFAULTS.tag,
    page: search.page ?? ROOMS_SEARCH_DEFAULTS.page,
  }
}

function parseValue<T extends z.ZodMiniType>(schema: T, value: unknown): z.output<T> | undefined {
  const result = z.safeParse(schema, value)
  return result.success ? result.data : undefined
}

/** Narrow a raw control value to a filter, or `undefined` when it is not one. */
export const parseStatusFilter = (value: unknown) => parseValue(filterSchema, value)
export const parseSort = (value: unknown) => parseValue(sortSchema, value)
export const parseLanguageFilter = (value: unknown) => parseValue(languageSchema, value)
