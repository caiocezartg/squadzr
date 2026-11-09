'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { AdminGameSort, AdminGameStatus } from '@squadzr/schemas'
import { DEFAULT_GAME_SORT, DEFAULT_GAME_STATUS } from '@/lib/admin-games-path'
import { adminGamesParamsFrom, type AdminGamesParams } from './games-query'

/** How long the field waits after the last keystroke before it searches. */
export const SEARCH_DEBOUNCE_MS = 300

export interface GamesSearch extends AdminGamesParams {
  /** What the field shows, which reaches the URL once typing pauses. */
  readonly draft: string
  readonly setDraft: (value: string) => void
  /** Empties the field and the URL's search at once. */
  readonly clearSearch: () => void
  readonly setStatus: (status: AdminGameStatus) => void
  readonly setSort: (sort: AdminGameSort) => void
  /** Whether the search or the status is narrowing the list. */
  readonly filtered: boolean
  /** Drops the search and the status together; the sort stays. */
  readonly clearFilters: () => void
  readonly goTo: (page: number) => void
}

/**
 * The Games list's search, status, sort and page, held in the URL as `?q=&status=&sort=&page=`. The
 * field starts from the URL and writes to it 300ms after typing stops; a new search, status or sort
 * goes back to the first page, and a default value (empty, `all`, `popularity`) drops its parameter.
 * The writes go through `window.history`, which the App Router follows in `useSearchParams` without a
 * navigation, so the previous results stay on screen while the next ones are read. A filter replaces
 * the history entry, a page is a new one.
 */
export function useGamesSearch(): GamesSearch {
  const pathname = usePathname()
  const params = useSearchParams()
  const { search, status, sort, page } = adminGamesParamsFrom({
    q: params.get('q'),
    status: params.get('status'),
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
    (next: AdminGamesParams, mode: 'push' | 'replace') => {
      const query = new URLSearchParams(window.location.search)
      setOrDelete(query, 'q', next.search)
      setOrDelete(query, 'status', next.status === DEFAULT_GAME_STATUS ? '' : next.status)
      setOrDelete(query, 'sort', next.sort === DEFAULT_GAME_SORT ? '' : next.sort)
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
    (patch: Partial<AdminGamesParams>) =>
      write({ search, status, sort, page: 1, ...patch }, 'replace'),
    [write, search, status, sort]
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
    change({ search: '', status: DEFAULT_GAME_STATUS })
  }, [change])

  const goTo = useCallback(
    (next: number) => {
      write({ search, status, sort, page: next }, 'push')
      // The pages sit under the table, so the next page starts from the top.
      document.documentElement.scrollTop = 0
    },
    [write, search, status, sort]
  )

  return {
    search,
    status,
    sort,
    page,
    draft,
    setDraft,
    clearSearch,
    setStatus: (next) => change({ status: next }),
    setSort: (next) => change({ sort: next }),
    filtered: search !== '' || status !== DEFAULT_GAME_STATUS,
    clearFilters,
    goTo,
  }
}

function setOrDelete(query: URLSearchParams, key: string, value: string): void {
  if (value) query.set(key, value)
  else query.delete(key)
}
