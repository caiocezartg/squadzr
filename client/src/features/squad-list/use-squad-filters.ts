import { useCallback, useEffect, useState } from 'react'
import {
  SQUADS_SEARCH_DEFAULTS,
  parseLanguageFilter,
  parseSort,
  parseStatusFilter,
  resolveSquadsSearch,
  type SquadsSearch,
} from './squads-search'
import type { SquadListQuery } from './squad-list-query'

/** How long a typed search or tag waits for the next keystroke before it reaches the URL. */
const TEXT_DEBOUNCE_MS = 300

/**
 * The URL side of the filters. Each route passes its own: the Squad Board reads and writes the App
 * Router's URL, My Squads the old app's. The filters only see the search, so they stay the same on
 * both routes.
 */
export interface SquadSearchAccess {
  /** The URL's search, parsed by `squadsSearchSchema`. */
  readonly search: SquadsSearch
  /** Writes the whole search to the URL, replacing its history entry. */
  readonly replace: (search: SquadsSearch) => void
}

interface UseSquadFiltersReturn {
  localSearch: string
  setLocalSearch: (v: string) => void
  localTag: string
  setLocalTag: (v: string) => void
  filter: string
  setFilter: (v: string) => void
  sort: string
  setSort: (v: string) => void
  language: string
  setLanguage: (v: string) => void
  page: number
  setPage: (v: number) => void
  hasActiveFilters: boolean
  /** The URL's filters, ready for `querySquadList`. */
  query: SquadListQuery
}

/** The search without the parameters that hold their default, so the URL stays clean. */
function withoutDefaults(search: SquadsSearch): SquadsSearch {
  const resolved = resolveSquadsSearch(search)
  return {
    ...(resolved.search !== SQUADS_SEARCH_DEFAULTS.search && { search: resolved.search }),
    ...(resolved.filter !== SQUADS_SEARCH_DEFAULTS.filter && { filter: resolved.filter }),
    ...(resolved.sort !== SQUADS_SEARCH_DEFAULTS.sort && { sort: resolved.sort }),
    ...(resolved.language !== SQUADS_SEARCH_DEFAULTS.language && { language: resolved.language }),
    ...(resolved.tag !== SQUADS_SEARCH_DEFAULTS.tag && { tag: resolved.tag }),
    ...(resolved.page !== SQUADS_SEARCH_DEFAULTS.page && { page: resolved.page }),
    ...(search.join !== undefined && { join: search.join }),
  }
}

export function useSquadFilters({ search, replace }: SquadSearchAccess): UseSquadFiltersReturn {
  const query = resolveSquadsSearch(search)
  const urlSearch = query.search
  const urlTag = query.tag

  // Local state for text inputs, decoupled from the URL so typing is not held up by the URL.
  const [localSearch, setLocalSearch] = useState(urlSearch)
  const [localTag, setLocalTag] = useState(urlTag)
  const [shownSearch, setShownSearch] = useState(urlSearch)
  const [shownTag, setShownTag] = useState(urlTag)

  // The URL's text flows into the inputs when it changes (back, forward or a shared link). It is
  // adjusted while rendering, not in an effect, so an input never paints the text it had before.
  if (shownSearch !== urlSearch) {
    setShownSearch(urlSearch)
    setLocalSearch(urlSearch)
  }
  if (shownTag !== urlTag) {
    setShownTag(urlTag)
    setLocalTag(urlTag)
  }

  const setParams = useCallback(
    (updates: Partial<SquadsSearch>) => replace(withoutDefaults({ ...search, ...updates })),
    [search, replace]
  )

  // Debounce: sync local text → URL after 300ms of inactivity
  useEffect(() => {
    if (localSearch === urlSearch) return
    const timer = setTimeout(() => setParams({ search: localSearch, page: 1 }), TEXT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [localSearch, urlSearch, setParams])

  useEffect(() => {
    if (localTag === urlTag) return
    const timer = setTimeout(() => setParams({ tag: localTag, page: 1 }), TEXT_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [localTag, urlTag, setParams])

  // The controls hand over plain strings: only a value the URL contract
  // accepts reaches the URL.
  const setFilter = useCallback(
    (v: string) => {
      const filter = parseStatusFilter(v)
      if (filter) setParams({ filter, page: 1 })
    },
    [setParams]
  )
  const setSort = useCallback(
    (v: string) => {
      const sort = parseSort(v)
      if (sort) setParams({ sort, page: 1 })
    },
    [setParams]
  )
  const setLanguage = useCallback(
    (v: string) => {
      const language = parseLanguageFilter(v)
      if (language) setParams({ language, page: 1 })
    },
    [setParams]
  )
  const setPage = useCallback((v: number) => setParams({ page: v }), [setParams])

  const hasActiveFilters =
    localSearch.trim().length > 0 ||
    query.filter !== SQUADS_SEARCH_DEFAULTS.filter ||
    query.language !== SQUADS_SEARCH_DEFAULTS.language ||
    localTag.trim().length > 0

  return {
    localSearch,
    setLocalSearch,
    localTag,
    setLocalTag,
    filter: query.filter,
    setFilter,
    sort: query.sort,
    setSort,
    language: query.language,
    setLanguage,
    page: query.page,
    setPage,
    hasActiveFilters,
    query,
  }
}
