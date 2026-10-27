import { useCallback, useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  squadsSearchFromParams,
  squadsSearchQuery,
  squadsSearchSchema,
  type SquadsSearch,
} from './squads-search'
import type { SquadSearchAccess } from './use-squad-filters'

/**
 * A squad list's URL access on the App Router: the search of the current URL, parsed by the search
 * schema, and a write of that URL which keeps its path. The write goes through `window.history`: the
 * App Router follows it in `useSearchParams` without a navigation, so the page derives its list from
 * the data it already has, and no request leaves. The write replaces the history entry, and the
 * page's first render reads the same search the server rendered with.
 */
export function useAppSquadSearch(): SquadSearchAccess {
  const pathname = usePathname()
  const params = useSearchParams()

  const search = useMemo(() => squadsSearchSchema.parse(squadsSearchFromParams(params)), [params])
  const replace = useCallback(
    (next: SquadsSearch) =>
      window.history.replaceState(null, '', `${pathname}${squadsSearchQuery(next)}`),
    [pathname]
  )

  return useMemo(() => ({ search, replace }), [search, replace])
}
