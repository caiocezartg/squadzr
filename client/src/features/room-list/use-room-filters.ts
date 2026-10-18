import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ROOMS_SEARCH_DEFAULTS,
  parseLanguageFilter,
  parseSort,
  parseStatusFilter,
  resolveRoomsSearch,
  type RoomsSearch,
} from './rooms-search'
import type { SquadListQuery } from './squad-list-query'

const DEFAULTS = ROOMS_SEARCH_DEFAULTS

interface UseRoomFiltersReturn {
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

export function useRoomFilters(from: '/rooms/' | '/rooms/my' = '/rooms/'): UseRoomFiltersReturn {
  const searchParams = useSearch({ from })
  const navigate = useNavigate({ from })

  const query = resolveRoomsSearch(searchParams)
  const urlSearch = query.search
  const urlTag = query.tag

  // Local state for text inputs — decoupled from URL to allow debouncing
  const [localSearch, setLocalSearch] = useState(urlSearch)
  const [localTag, setLocalTag] = useState(urlTag)

  const setParams = useCallback(
    (updates: Partial<RoomsSearch>) => {
      navigate({
        search: (prev) => {
          const merged = { ...prev, ...updates }
          // Omit default values to keep URLs clean
          return {
            ...(merged.search !== DEFAULTS.search && { search: merged.search }),
            ...(merged.filter !== DEFAULTS.filter && { filter: merged.filter }),
            ...(merged.sort !== DEFAULTS.sort && { sort: merged.sort }),
            ...(merged.language !== DEFAULTS.language && { language: merged.language }),
            ...(merged.tag !== DEFAULTS.tag && { tag: merged.tag }),
            ...(merged.page !== DEFAULTS.page && { page: merged.page }),
            ...(merged.join !== undefined && { join: merged.join }),
          }
        },
        replace: true,
      })
    },
    [navigate]
  )

  // Debounce: sync local text → URL after 300ms of inactivity
  useEffect(() => {
    if (localSearch === urlSearch) return
    const timer = setTimeout(() => setParams({ search: localSearch, page: 1 }), 300)
    return () => clearTimeout(timer)
  }, [localSearch, urlSearch, setParams])

  useEffect(() => {
    if (localTag === urlTag) return
    const timer = setTimeout(() => setParams({ tag: localTag, page: 1 }), 300)
    return () => clearTimeout(timer)
  }, [localTag, urlTag, setParams])

  // Reverse sync: URL → local state (back/forward navigation or shared links)
  useEffect(() => {
    setLocalSearch(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    setLocalTag(urlTag)
  }, [urlTag])

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
    query.filter !== DEFAULTS.filter ||
    query.language !== DEFAULTS.language ||
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
