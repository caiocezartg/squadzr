import { useCallback, useMemo } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { SquadSearchAccess, SquadsSearch } from '@/features/squad-list'

/**
 * My Squads' URL access on the old app's router: the search of the route at `from`, and a replace of
 * that search. The route is still a TanStack route, so the search and its writes go through its router.
 */
export function useLegacySquadSearch(from: '/rooms/my'): SquadSearchAccess {
  const search = useSearch({ from })
  const navigate = useNavigate({ from })
  const replace = useCallback(
    (next: SquadsSearch) => navigate({ search: next, replace: true }),
    [navigate]
  )

  return useMemo(() => ({ search, replace }), [search, replace])
}
