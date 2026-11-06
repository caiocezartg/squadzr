import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  changeUserRoleResponseSchema,
  type AssignableRole,
} from '@squadzr/schemas'
import { api } from '@/lib/api'

/** The cache key of one page of the user list for a search. */
export function adminUsersQueryKey(search: string, page: number) {
  return ['admin', 'users', 'list', search, page] as const
}

/** The cache key of one user's page. */
export function adminUserQueryKey(id: string) {
  return ['admin', 'users', 'detail', id] as const
}

export interface AdminUsersParams {
  readonly search: string
  readonly page: number
}

/**
 * The search and page a URL's `?q=&page=` values ask for, through the shared contract: an absent or
 * invalid page is the first, an absent or too long search is no search.
 */
export function adminUsersParamsFrom(values: {
  readonly q?: string | readonly string[] | null
  readonly page?: string | readonly string[] | null
}): AdminUsersParams {
  const first = (value: string | readonly string[] | null | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? undefined
  const parsed = adminUsersQuerySchema.safeParse({ q: first(values.q), page: first(values.page) })
  if (parsed.success) return { search: parsed.data.q ?? '', page: parsed.data.page }

  const page = adminUsersQuerySchema.shape.page.safeParse(first(values.page))
  return { search: '', page: page.success ? page.data : 1 }
}

function readAdminUsers(search: string, page: number) {
  const params = new URLSearchParams({ page: String(page) })
  if (search) params.set('q', search)
  return api.get(`/api/admin/users?${params.toString()}`, adminUsersResponseSchema)
}

/**
 * One page of the user list. A page the cache holds (the server's prefetch, an earlier visit) renders
 * at once; moving to one the cache lacks keeps the previous results on screen until the new ones land.
 */
export function useAdminUsers(search: string, page: number) {
  return useQuery({
    queryKey: adminUsersQueryKey(search, page),
    queryFn: () => readAdminUsers(search, page),
    placeholderData: keepPreviousData,
  })
}

/** One user's page. */
export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminUserQueryKey(id),
    queryFn: () => api.get(`/api/admin/users/${encodeURIComponent(id)}`, adminUserResponseSchema),
  })
}

/**
 * Sets a user's role. On success the user's page and every list are read again, so the role shows
 * everywhere; the Audit page reads the new entry the next time it is opened.
 */
export function useChangeUserRole(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (role: AssignableRole) =>
      api.put(
        `/api/admin/users/${encodeURIComponent(id)}/role`,
        { role },
        changeUserRoleResponseSchema
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminUserQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'users', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] }),
      ])
    },
  })
}
