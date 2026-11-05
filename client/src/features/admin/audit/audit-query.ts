import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { auditEntriesResponseSchema, pageQuerySchema } from '@squadzr/schemas'
import { api } from '@/lib/api'

/** The cache key of one page of the audit. */
export function auditQueryKey(page: number) {
  return ['admin', 'audit', page] as const
}

/**
 * The page a `?page=` value asks for, through the shared pagination contract: an absent or invalid
 * value (empty, not a number, below 1) is the first page.
 */
export function auditPageFrom(value: string | readonly string[] | null | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = pageQuerySchema.safeParse({ page: raw ?? undefined })
  return parsed.success ? parsed.data.page : 1
}

function readAuditEntries(page: number) {
  return api.get(`/api/admin/audit?page=${page}`, auditEntriesResponseSchema)
}

/**
 * One page of the audit. A page the cache holds (the server's prefetch, an earlier visit) renders at
 * once; moving to a page the cache lacks keeps the previous page on screen until the new one lands, so
 * the table never empties in between.
 */
export function useAuditEntries(page: number) {
  return useQuery({
    queryKey: auditQueryKey(page),
    queryFn: () => readAuditEntries(page),
    placeholderData: keepPreviousData,
  })
}
