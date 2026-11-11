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
