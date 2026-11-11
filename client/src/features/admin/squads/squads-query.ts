import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminSquadDetailResponseSchema,
  adminSquadsQuerySchema,
  adminSquadsResponseSchema,
} from '@squadzr/schemas'
import { adminSquadsPath, type AdminSquadsParams } from '@/lib/admin-squads-path'
import { api } from '@/lib/api'

/** The cache key of one page of the Open Squads list for a search, filters and sort. */
export function adminSquadsQueryKey(params: AdminSquadsParams) {
  const { search, gameId, platform, language, sort, page } = params
  return ['admin', 'squads', 'list', search, gameId, platform, language, sort, page] as const
}

/** The cache key of one Open Squad's detail. */
export function adminSquadQueryKey(id: string) {
  return ['admin', 'squads', 'detail', id] as const
}

export type { AdminSquadsParams }

type UrlValue = string | readonly string[] | null | undefined

const first = (value: UrlValue) => (Array.isArray(value) ? value[0] : value) ?? undefined

/**
 * The search, filters, sort and page a URL's `?q=&gameId=&platform=&language=&sort=&page=` values ask
 * for, through the shared contract: an absent or invalid page is the first, an invalid game, platform
 * or language is no filter, an invalid sort is `newest`, an absent or too long search is no search. A
 * value that breaks the contract never takes the others with it.
 */
export function adminSquadsParamsFrom(values: {
  readonly q?: UrlValue
  readonly gameId?: UrlValue
  readonly platform?: UrlValue
  readonly language?: UrlValue
  readonly sort?: UrlValue
  readonly page?: UrlValue
}): AdminSquadsParams {
  const shape = adminSquadsQuerySchema.shape
  const search = shape.q.safeParse(first(values.q))
  const gameId = shape.gameId.safeParse(first(values.gameId))
  const platform = shape.platform.safeParse(first(values.platform))
  const language = shape.language.safeParse(first(values.language))
  const sort = shape.sort.safeParse(first(values.sort))
  const page = shape.page.safeParse(first(values.page))
  return {
    search: (search.success ? search.data : undefined) ?? '',
    gameId: (gameId.success ? gameId.data : undefined) ?? '',
    platform: (platform.success ? platform.data : undefined) ?? '',
    language: (language.success ? language.data : undefined) ?? '',
    sort: (sort.success ? sort.data : undefined) ?? 'newest',
    page: page.success ? page.data : 1,
  }
}

/**
 * One page of the Open Squads. A page the cache holds (the server's prefetch, an earlier visit) renders
 * at once; moving to one the cache lacks keeps the previous results on screen until the new ones land.
 */
export function useAdminSquads(params: AdminSquadsParams) {
  return useQuery({
    queryKey: adminSquadsQueryKey(params),
    queryFn: () => api.get(adminSquadsPath(params), adminSquadsResponseSchema),
    placeholderData: keepPreviousData,
  })
}

/** One Open Squad with its roster and full Discord invite; read when its side panel opens. */
export function useAdminSquad(id: string | null) {
  return useQuery({
    queryKey: adminSquadQueryKey(id ?? ''),
    queryFn: () =>
      api.get(`/api/admin/squads/${encodeURIComponent(id ?? '')}`, adminSquadDetailResponseSchema),
    enabled: id !== null,
  })
}

/**
 * Closes an Open Squad with a reason. On success the panel's reads are marked stale (the lists, the
 * overview's counts, the Audit entry); the closed Squad's own detail is removed from the cache first,
 * since reading it again would only answer 404.
 */
export function useCloseSquad(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reason: string) =>
      api.post(`/api/admin/squads/${encodeURIComponent(id)}/close`, { reason }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: adminSquadQueryKey(id) })
      return queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })
}
