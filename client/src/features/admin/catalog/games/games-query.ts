import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  adminGameDetailResponseSchema,
  adminGamesQuerySchema,
  adminGamesResponseSchema,
  adminGamesSummarySchema,
} from '@squadzr/schemas'
import {
  ADMIN_GAMES_SUMMARY_PATH,
  adminGamePath,
  adminGamesPath,
  DEFAULT_GAME_SORT,
  DEFAULT_GAME_STATUS,
  type AdminGamesParams,
} from '@/lib/admin-games-path'
import { api } from '@/lib/api'

export type { AdminGamesParams }

/** The cache key of one page of the Games list for a search, status and sort. */
export function adminGamesQueryKey(params: AdminGamesParams) {
  const { search, status, sort, page } = params
  return ['admin', 'catalog-games', 'list', search, status, sort, page] as const
}

/** The cache key of the Games tab's summary. */
export function adminGamesSummaryQueryKey() {
  return ['admin', 'catalog-games', 'summary'] as const
}

/** The cache key of one game's page. */
export function adminGameQueryKey(id: string) {
  return ['admin', 'catalog-games', 'detail', id] as const
}

type UrlValue = string | readonly string[] | null | undefined

const first = (value: UrlValue) => (Array.isArray(value) ? value[0] : value) ?? undefined

/**
 * The search, status, sort and page a URL's `?q=&status=&sort=&page=` values ask for, through the
 * shared contract: an absent or invalid page is the first, an invalid status is every game, an invalid
 * sort is by popularity, an absent or too long search is no search. A value that breaks the contract
 * never takes the others with it.
 */
export function adminGamesParamsFrom(values: {
  readonly q?: UrlValue
  readonly status?: UrlValue
  readonly sort?: UrlValue
  readonly page?: UrlValue
}): AdminGamesParams {
  const shape = adminGamesQuerySchema.shape
  const search = shape.q.safeParse(first(values.q))
  const status = shape.status.safeParse(first(values.status))
  const sort = shape.sort.safeParse(first(values.sort))
  const page = shape.page.safeParse(first(values.page))
  return {
    search: (search.success ? search.data : undefined) ?? '',
    status: (status.success ? status.data : undefined) ?? DEFAULT_GAME_STATUS,
    sort: (sort.success ? sort.data : undefined) ?? DEFAULT_GAME_SORT,
    page: page.success ? page.data : 1,
  }
}

/**
 * One page of the Games list. A page the cache holds (the server's prefetch, an earlier visit) renders
 * at once; moving to one the cache lacks keeps the previous results on screen until the new ones land.
 */
export function useAdminGames(params: AdminGamesParams) {
  return useQuery({
    queryKey: adminGamesQueryKey(params),
    queryFn: () => api.get(adminGamesPath(params), adminGamesResponseSchema),
    placeholderData: keepPreviousData,
  })
}

/** The Games tab's summary: the counts by status and what the last import changed. */
export function useAdminGamesSummary() {
  return useQuery({
    queryKey: adminGamesSummaryQueryKey(),
    queryFn: () => api.get(ADMIN_GAMES_SUMMARY_PATH, adminGamesSummarySchema),
  })
}

/** One game's page: every field, its usage and its newest Open Squads. */
export function useAdminGame(id: string) {
  return useQuery({
    queryKey: adminGameQueryKey(id),
    queryFn: () => api.get(adminGamePath(id), adminGameDetailResponseSchema),
  })
}
