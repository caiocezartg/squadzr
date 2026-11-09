'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { AdminSquadSort, Platform, RoomLanguage } from '@squadzr/schemas'
import { adminSquadsParamsFrom, type AdminSquadsParams } from './squads-query'

/** How long the field waits after the last keystroke before it searches. */
export const SEARCH_DEBOUNCE_MS = 300

type SquadsFilters = Omit<AdminSquadsParams, 'search'> & { readonly search: string }

export interface SquadsSearch extends SquadsFilters {
  /** What the field shows, which reaches the URL once typing pauses. */
  readonly draft: string
  readonly setDraft: (value: string) => void
  /** Empties the field and the URL's search at once. */
  readonly clearSearch: () => void
  /** Keeps one Game, or every Game for an empty id. */
  readonly setGame: (gameId: string) => void
  /** Keeps one platform, or every platform for an empty value. */
  readonly setPlatform: (platform: Platform | '') => void
  /** Keeps one Squad language, or every language for an empty value. */
  readonly setLanguage: (language: RoomLanguage | '') => void
  readonly setSort: (sort: AdminSquadSort) => void
  /** Whether any of the search, Game, platform or language is narrowing the list. */
  readonly filtered: boolean
  /** Drops the search, Game, platform and language together; the sort stays. */
  readonly clearFilters: () => void
  readonly goTo: (page: number) => void
}

/**
 * The Squads list's search, filters, sort and page, held in the URL as
 * `?q=&gameId=&platform=&language=&sort=&page=`. The field starts from the URL and writes to it 300ms
 * after typing stops; a new search, filter or sort goes back to the first page, and a default value
 * (empty, or `newest`) drops its parameter. The writes go through `window.history`, which the App
 * Router follows in `useSearchParams` without a navigation, so the previous results stay on screen
 * while the next ones are read. A filter replaces the history entry, a page is a new one. Other
 * parameters (the open Squad) are kept.
 */
export function useSquadsSearch(): SquadsSearch {
  const pathname = usePathname()
  const params = useSearchParams()
  const { search, gameId, platform, language, sort, page } = adminSquadsParamsFrom({
    q: params.get('q'),
    gameId: params.get('gameId'),
    platform: params.get('platform'),
    language: params.get('language'),
    sort: params.get('sort'),
    page: params.get('page'),
  })
  const [draft, setDraft] = useState(search)
  const [urlSearch, setUrlSearch] = useState(search)

  // A search the URL changed on its own (a link to the bare list, Back) replaces what the field holds.
  if (search !== urlSearch) {
    setUrlSearch(search)
    if (draft.trim() !== search) setDraft(search)
  }

  const write = useCallback(
    (next: SquadsFilters, mode: 'push' | 'replace') => {
      const query = new URLSearchParams(window.location.search)
      setOrDelete(query, 'q', next.search)
      setOrDelete(query, 'gameId', next.gameId)
      setOrDelete(query, 'platform', next.platform)
      setOrDelete(query, 'language', next.language)
      setOrDelete(query, 'sort', next.sort === 'newest' ? '' : next.sort)
      setOrDelete(query, 'page', next.page > 1 ? String(next.page) : '')
      const value = query.toString()
      const url = value ? `${pathname}?${value}` : pathname
      if (mode === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    [pathname]
  )

  // Any change but a page starts again from the first one.
  const change = useCallback(
    (patch: Partial<SquadsFilters>) =>
      write({ search, gameId, platform, language, sort, page: 1, ...patch }, 'replace'),
    [write, search, gameId, platform, language, sort]
  )

  useEffect(() => {
    const term = draft.trim()
    if (term === search) return
    const timer = setTimeout(() => change({ search: term }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, search, change])

  const clearSearch = useCallback(() => {
    setDraft('')
    change({ search: '' })
  }, [change])

  const clearFilters = useCallback(() => {
    setDraft('')
    change({ search: '', gameId: '', platform: '', language: '' })
  }, [change])

  const goTo = useCallback(
    (next: number) => {
      write({ search, gameId, platform, language, sort, page: next }, 'push')
      // The pages sit under the table, so the next page starts from the top.
      document.documentElement.scrollTop = 0
    },
    [write, search, gameId, platform, language, sort]
  )

  return {
    search,
    gameId,
    platform,
    language,
    sort,
    page,
    draft,
    setDraft,
    clearSearch,
    setGame: (gameId) => change({ gameId }),
    setPlatform: (platform) => change({ platform }),
    setLanguage: (language) => change({ language }),
    setSort: (sort) => change({ sort }),
    filtered: search !== '' || gameId !== '' || platform !== '' || language !== '',
    clearFilters,
    goTo,
  }
}

function setOrDelete(query: URLSearchParams, key: string, value: string): void {
  if (value) query.set(key, value)
  else query.delete(key)
}
