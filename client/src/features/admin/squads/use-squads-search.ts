'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { adminSquadsParamsFrom } from './squads-query'

/** How long the field waits after the last keystroke before it searches. */
export const SEARCH_DEBOUNCE_MS = 300

interface SquadsFilters {
  readonly search: string
  readonly gameId: string
  readonly page: number
}

export interface SquadsSearch extends SquadsFilters {
  /** What the field shows, which reaches the URL once typing pauses. */
  readonly draft: string
  readonly setDraft: (value: string) => void
  /** Empties the field and the URL's search at once. */
  readonly clearSearch: () => void
  /** Keeps one Game, or every Game for an empty id. */
  readonly setGame: (gameId: string) => void
  /** Drops the search and the Game together. */
  readonly clearFilters: () => void
  readonly goTo: (page: number) => void
}

/**
 * The Squads list's search, Game and page, held in the URL as `?q=&gameId=&page=`. The field starts
 * from the URL and writes to it 300ms after typing stops; a new search or Game goes back to the first
 * page, and an empty value drops its parameter. The writes go through `window.history`, which the App
 * Router follows in `useSearchParams` without a navigation, so the previous results stay on screen while
 * the next ones are read. A filter replaces the history entry, a page is a new one. Other parameters
 * (the open Squad) are kept.
 */
export function useSquadsSearch(): SquadsSearch {
  const pathname = usePathname()
  const params = useSearchParams()
  const { search, gameId, page } = adminSquadsParamsFrom({
    q: params.get('q'),
    gameId: params.get('gameId'),
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
      setOrDelete(query, 'page', next.page > 1 ? String(next.page) : '')
      const value = query.toString()
      const url = value ? `${pathname}?${value}` : pathname
      if (mode === 'push') window.history.pushState(null, '', url)
      else window.history.replaceState(null, '', url)
    },
    [pathname]
  )

  useEffect(() => {
    const term = draft.trim()
    if (term === search) return
    const timer = setTimeout(
      () => write({ search: term, gameId, page: 1 }, 'replace'),
      SEARCH_DEBOUNCE_MS
    )
    return () => clearTimeout(timer)
  }, [draft, search, gameId, write])

  const clearSearch = useCallback(() => {
    setDraft('')
    write({ search: '', gameId, page: 1 }, 'replace')
  }, [gameId, write])

  const setGame = useCallback(
    (next: string) => write({ search, gameId: next, page: 1 }, 'replace'),
    [search, write]
  )

  const clearFilters = useCallback(() => {
    setDraft('')
    write({ search: '', gameId: '', page: 1 }, 'replace')
  }, [write])

  const goTo = useCallback(
    (next: number) => {
      write({ search, gameId, page: next }, 'push')
      // The pages sit under the table, so the next page starts from the top.
      document.documentElement.scrollTop = 0
    },
    [search, gameId, write]
  )

  return { search, gameId, page, draft, setDraft, clearSearch, setGame, clearFilters, goTo }
}

function setOrDelete(query: URLSearchParams, key: string, value: string): void {
  if (value) query.set(key, value)
  else query.delete(key)
}
