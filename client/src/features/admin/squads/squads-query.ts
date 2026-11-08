import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminSquadDetailResponseSchema,
  adminSquadsQuerySchema,
  adminSquadsResponseSchema,
} from '@squadzr/schemas'
import { adminSquadsPath } from '@/lib/admin-squads-path'
import { api } from '@/lib/api'

/** The cache key of one page of the Open Squads list for a search and game filter. */
export function adminSquadsQueryKey(search: string, gameId: string, page: number) {
  return ['admin', 'squads', 'list', search, gameId, page] as const
}

/** The cache key of one Open Squad's detail. */
export function adminSquadQueryKey(id: string) {
  return ['admin', 'squads', 'detail', id] as const
}

export interface AdminSquadsParams {
  /** Matches the Squad's name or code, or the host's name; empty is no search. */
  readonly search: string
  /** The Game to keep; empty is every Game. */
  readonly gameId: string
  readonly page: number
}

type UrlValue = string | readonly string[] | null | undefined

const first = (value: UrlValue) => (Array.isArray(value) ? value[0] : value) ?? undefined

/**
 * The search, game and page a URL's `?q=&gameId=&page=` values ask for, through the shared contract:
 * an absent or invalid page is the first, an invalid game is every game, an absent or too long search
 * is no search. A value that breaks the contract never takes the others with it.
 */
export function adminSquadsParamsFrom(values: {
  readonly q?: UrlValue
  readonly gameId?: UrlValue
  readonly page?: UrlValue
}): AdminSquadsParams {
  const shape = adminSquadsQuerySchema.shape
  const search = shape.q.safeParse(first(values.q))
  const gameId = shape.gameId.safeParse(first(values.gameId))
  const page = shape.page.safeParse(first(values.page))
  return {
    search: (search.success ? search.data : undefined) ?? '',
    gameId: (gameId.success ? gameId.data : undefined) ?? '',
    page: page.success ? page.data : 1,
  }
}

/**
 * One page of the Open Squads. A page the cache holds (the server's prefetch, an earlier visit) renders
 * at once; moving to one the cache lacks keeps the previous results on screen until the new ones land.
 */
export function useAdminSquads(search: string, gameId: string, page: number) {
  return useQuery({
    queryKey: adminSquadsQueryKey(search, gameId, page),
    queryFn: () => api.get(adminSquadsPath(search, gameId, page), adminSquadsResponseSchema),
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
 * overview's counts, the Audit entry); the closed Squad's own detail is left as it is, since reading it
 * again would only answer 404.
 */
export function useCloseSquad(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (reason: string) =>
      api.post(`/api/admin/squads/${encodeURIComponent(id)}/close`, { reason }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['admin'],
        predicate: (query) => query.queryHash !== JSON.stringify(adminSquadQueryKey(id)),
      }),
  })
}
