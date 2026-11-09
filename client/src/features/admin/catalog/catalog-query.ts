import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { catalogImportRunsResponseSchema } from '@squadzr/schemas'
import { api } from '@/lib/api'
import { auditPageFrom } from '../audit/audit-query'

/** The cache key of one page of the Catalog Import Run history. */
export function catalogRunsQueryKey(page: number) {
  return ['admin', 'catalog-runs', page] as const
}

/**
 * The page a `?page=` value asks for, through the shared pagination contract the Audit reads its page
 * with: an absent or invalid value is the first page.
 */
export const catalogPageFrom = auditPageFrom

function readCatalogImportRuns(page: number) {
  return api.get(`/api/admin/catalog-import/runs?page=${page}`, catalogImportRunsResponseSchema)
}

/**
 * One page of the run history. A page the cache holds (the server's prefetch, an earlier visit)
 * renders at once; moving to a page the cache lacks keeps the previous page on screen until the new
 * one lands, so the table never empties in between.
 */
export function useCatalogImportRuns(page: number) {
  return useQuery({
    queryKey: catalogRunsQueryKey(page),
    queryFn: () => readCatalogImportRuns(page),
    placeholderData: keepPreviousData,
  })
}
