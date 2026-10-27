import { useCallback } from 'react'
import { useDebouncedUrlText } from './use-debounced-url-text'
import {
  SQUADS_SEARCH_DEFAULTS,
  parseLanguageFilter,
  parseSort,
  parseStatusFilter,
  resolveSquadsSearch,
  type SquadLanguageFilter,
  type SquadSort,
  type SquadStatusFilter,
  type SquadsSearch,
} from './squads-search'
import { normalizeTag, normalizeTags } from './squad-tags'
import type { SquadListQuery } from './squad-list-query'

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

export interface UseSquadFiltersReturn {
  localSearch: string
  setLocalSearch: (v: string) => void
  /** The text of My Squads' single tag input, which is the first selected tag. */
  localTag: string
  setLocalTag: (v: string) => void
  filter: SquadStatusFilter
  setFilter: (v: string) => void
  sort: SquadSort
  setSort: (v: string) => void
  language: SquadLanguageFilter
  setLanguage: (v: string) => void
  page: number
  setPage: (v: number) => void
  /** The selected tags, normalized, in the order they were picked. */
  tags: readonly string[]
  /** Selects the tag, or deselects it when it is selected. */
  toggleTag: (tag: string) => void
  /** Deselects the tag. */
  removeTag: (tag: string) => void
  /** Puts every control back to its default, and leaves the search text as it is. */
  clearFilters: () => void
  /** The availability, language and tag filters in use: what the board's chips list. */
  activeFilterCount: number
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
    ...(resolved.tag.length > 0 && { tag: resolved.tag }),
    ...(resolved.page !== SQUADS_SEARCH_DEFAULTS.page && { page: resolved.page }),
    ...(search.join !== undefined && { join: search.join }),
  }
}

export function useSquadFilters({ search, replace }: SquadSearchAccess): UseSquadFiltersReturn {
  const query = resolveSquadsSearch(search)
  const urlSearch = query.search
  const urlTag = query.tag[0] ?? ''

  const setParams = useCallback(
    (updates: Partial<SquadsSearch>) => replace(withoutDefaults({ ...search, ...updates })),
    [search, replace]
  )

  const [localSearch, setLocalSearch] = useDebouncedUrlText({
    urlText: urlSearch,
    inSync: useCallback((text: string) => text === urlSearch, [urlSearch]),
    commit: useCallback((text: string) => setParams({ search: text, page: 1 }), [setParams]),
  })
  const [localTag, setLocalTag] = useDebouncedUrlText({
    urlText: urlTag,
    inSync: useCallback((text: string) => normalizeTag(text) === urlTag, [urlTag]),
    commit: useCallback(
      (text: string) => setParams({ tag: normalizeTags([text]), page: 1 }),
      [setParams]
    ),
  })

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

  const selectedTags = query.tag
  const toggleTag = useCallback(
    (tag: string) => {
      const target = normalizeTag(tag)
      const tags = selectedTags.includes(target)
        ? selectedTags.filter((selected) => selected !== target)
        : normalizeTags([...selectedTags, target])
      setParams({ tag: tags, page: 1 })
    },
    [selectedTags, setParams]
  )
  const removeTag = useCallback(
    (tag: string) =>
      setParams({
        tag: selectedTags.filter((selected) => selected !== normalizeTag(tag)),
        page: 1,
      }),
    [selectedTags, setParams]
  )
  const clearFilters = useCallback(
    () =>
      setParams({
        filter: SQUADS_SEARCH_DEFAULTS.filter,
        language: SQUADS_SEARCH_DEFAULTS.language,
        sort: SQUADS_SEARCH_DEFAULTS.sort,
        tag: SQUADS_SEARCH_DEFAULTS.tag,
        page: 1,
      }),
    [setParams]
  )

  const activeFilterCount =
    Number(query.filter !== SQUADS_SEARCH_DEFAULTS.filter) +
    Number(query.language !== SQUADS_SEARCH_DEFAULTS.language) +
    query.tag.length
  const hasActiveFilters =
    localSearch.trim().length > 0 || activeFilterCount > 0 || localTag.trim().length > 0

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
    tags: query.tag,
    toggleTag,
    removeTag,
    clearFilters,
    activeFilterCount,
    hasActiveFilters,
    query,
  }
}
