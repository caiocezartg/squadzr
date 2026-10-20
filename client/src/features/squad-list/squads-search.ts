// `zod/mini` keeps the same contracts as the classic build while letting the
// bundler drop every schema the route validation does not use.
import * as z from 'zod/mini'

const filterSchema = z.enum(['all', 'has-space', 'almost-full'])
const sortSchema = z.enum(['newest', 'oldest'])
const languageSchema = z.enum(['all', 'pt-br', 'en'])

export type SquadStatusFilter = z.infer<typeof filterSchema>
export type SquadSort = z.infer<typeof sortSchema>
export type SquadLanguageFilter = z.infer<typeof languageSchema>

/** An invalid parameter drops out of the result, so its default applies. */
function lenient<T extends z.ZodMiniType>(schema: T) {
  return z.catch(z.optional(schema), undefined)
}

/**
 * A room code as the contract writes it: six letters or digits. The server reads a code without
 * regard to case, so a lowercase invite still joins. Anything else never reaches a request path.
 */
const roomCodeSchema = z.string().check(z.regex(/^[A-Za-z0-9]{6}$/))

/**
 * The URL search contract of the squad lists. Every parameter is parsed on its
 * own: an invalid one is dropped (its default applies) and every valid one is
 * kept, `join` included, so a bad board URL never throws.
 */
export const squadsSearchSchema = z.catch(
  z.object({
    search: lenient(z.string()),
    filter: lenient(filterSchema),
    sort: lenient(sortSchema),
    language: lenient(languageSchema),
    tag: lenient(z.string()),
    page: lenient(z.coerce.number().check(z.int(), z.gte(1))),
    join: lenient(roomCodeSchema),
  }),
  {}
)

export type SquadsSearch = z.infer<typeof squadsSearchSchema>

/** A search with every list parameter resolved to a value. */
export type ResolvedSquadsSearch = Required<Omit<SquadsSearch, 'join'>>

/** The search the lists show when the URL leaves a parameter out. */
export const SQUADS_SEARCH_DEFAULTS: ResolvedSquadsSearch = {
  search: '',
  filter: 'all',
  sort: 'newest',
  language: 'all',
  tag: '',
  page: 1,
}

export function resolveSquadsSearch(search: SquadsSearch): ResolvedSquadsSearch {
  return {
    search: search.search ?? SQUADS_SEARCH_DEFAULTS.search,
    filter: search.filter ?? SQUADS_SEARCH_DEFAULTS.filter,
    sort: search.sort ?? SQUADS_SEARCH_DEFAULTS.sort,
    language: search.language ?? SQUADS_SEARCH_DEFAULTS.language,
    tag: search.tag ?? SQUADS_SEARCH_DEFAULTS.tag,
    page: search.page ?? SQUADS_SEARCH_DEFAULTS.page,
  }
}

/** The query string of a search: each parameter it carries, `?` included, or nothing. */
export function squadsSearchQuery(search: SquadsSearch): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

function parseValue<T extends z.ZodMiniType>(schema: T, value: unknown): z.output<T> | undefined {
  const result = z.safeParse(schema, value)
  return result.success ? result.data : undefined
}

/** Narrow a raw control value to a filter, or `undefined` when it is not one. */
export const parseStatusFilter = (value: unknown) => parseValue(filterSchema, value)
export const parseSort = (value: unknown) => parseValue(sortSchema, value)
export const parseLanguageFilter = (value: unknown) => parseValue(languageSchema, value)
