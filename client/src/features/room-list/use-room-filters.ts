import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { Game, PublicRoom } from '@/types'

const DEFAULTS = {
  search: '',
  filter: 'all' as const,
  sort: 'newest' as const,
  language: 'all' as const,
  tag: '',
  page: 1,
}

type SearchParams = {
  search?: string
  filter?: 'all' | 'has-space' | 'almost-full'
  sort?: 'newest' | 'oldest'
  language?: 'all' | 'pt-br' | 'en'
  tag?: string
  page?: number
  join?: string
}

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
  applyFilters: (rooms: PublicRoom[]) => PublicRoom[]
}

export function useRoomFilters(
  gamesMap: Map<string, Game>,
  from: '/rooms/' | '/rooms/my' = '/rooms/'
): UseRoomFiltersReturn {
  const searchParams = useSearch({ from })
  const navigate = useNavigate({ from })

  const urlSearch = searchParams.search ?? DEFAULTS.search
  const urlTag = searchParams.tag ?? DEFAULTS.tag

  // Local state for text inputs — decoupled from URL to allow debouncing
  const [localSearch, setLocalSearch] = useState(urlSearch)
  const [localTag, setLocalTag] = useState(urlTag)

  const setParams = useCallback(
    (updates: Partial<SearchParams>) => {
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

  const setFilter = useCallback(
    (v: string) => setParams({ filter: v as SearchParams['filter'], page: 1 }),
    [setParams]
  )
  const setSort = useCallback(
    (v: string) => setParams({ sort: v as SearchParams['sort'], page: 1 }),
    [setParams]
  )
  const setLanguage = useCallback(
    (v: string) => setParams({ language: v as SearchParams['language'], page: 1 }),
    [setParams]
  )
  const setPage = useCallback((v: number) => setParams({ page: v }), [setParams])

  const currentSearch = urlSearch
  const currentFilter = searchParams.filter ?? DEFAULTS.filter
  const currentSort = searchParams.sort ?? DEFAULTS.sort
  const currentLanguage = searchParams.language ?? DEFAULTS.language
  const currentTag = urlTag

  const hasActiveFilters =
    localSearch.trim().length > 0 ||
    currentFilter !== 'all' ||
    currentLanguage !== 'all' ||
    localTag.trim().length > 0

  function applyFilters(rooms: PublicRoom[]): PublicRoom[] {
    let result = [...rooms]

    if (currentSearch.trim()) {
      const term = currentSearch.toLowerCase()
      result = result.filter((room) => {
        const game = gamesMap.get(room.gameId)
        return game?.name.toLowerCase().includes(term) || room.name.toLowerCase().includes(term)
      })
    }

    if (currentFilter === 'has-space') {
      result = result.filter((room) => (room.memberCount ?? 1) < room.maxPlayers)
    } else if (currentFilter === 'almost-full') {
      result = result.filter((room) => {
        const members = room.memberCount ?? 1
        return members >= room.maxPlayers - 1 && members < room.maxPlayers
      })
    }

    if (currentLanguage !== 'all') {
      result = result.filter((room) => room.language === currentLanguage)
    }

    if (currentTag.trim()) {
      const term = currentTag.trim().toLowerCase().replace(/^#/, '')
      result = result.filter((room) => room.tags.some((t) => t.toLowerCase().includes(term)))
    }

    if (currentSort === 'newest') {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } else if (currentSort === 'oldest') {
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    }

    return result
  }

  return {
    localSearch,
    setLocalSearch,
    localTag,
    setLocalTag,
    filter: currentFilter,
    setFilter,
    sort: currentSort,
    setSort,
    language: currentLanguage,
    setLanguage,
    page: searchParams.page ?? DEFAULTS.page,
    setPage,
    hasActiveFilters,
    applyFilters,
  }
}
