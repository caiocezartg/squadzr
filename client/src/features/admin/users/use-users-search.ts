'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { adminUsersParamsFrom } from './users-query'

/** How long the field waits after the last keystroke before it searches. */
export const SEARCH_DEBOUNCE_MS = 300

export interface UsersSearch {
  /** The search and page the URL holds, which the list reads. */
  readonly search: string
  readonly page: number
  /** What the field shows, which reaches the URL once typing pauses. */
  readonly draft: string
  readonly setDraft: (value: string) => void
  /** Empties the field and the URL's search at once. */
  readonly clear: () => void
  readonly goTo: (page: number) => void
}

/**
 * The Users list's search and page, held in the URL as `?q=&page=`. The field starts from the URL and
 * writes to it 300ms after typing stops, back on the first page; an empty search drops the parameter.
 * The writes go through `window.history`, which the App Router follows in `useSearchParams` without a
 * navigation, so the previous results stay on screen while the next ones are read. A search replaces
 * the history entry, a page is a new one.
 */
export function useUsersSearch(): UsersSearch {
  const pathname = usePathname()
  const params = useSearchParams()
  const { search, page } = adminUsersParamsFrom({ q: params.get('q'), page: params.get('page') })
  const [draft, setDraft] = useState(search)
  const [urlSearch, setUrlSearch] = useState(search)

  // A search the URL changed on its own (a link to the bare list, Back) replaces what the field holds.
  if (search !== urlSearch) {
    setUrlSearch(search)
    if (draft.trim() !== search) setDraft(search)
  }

  const write = useCallback(
    (next: { readonly search: string; readonly page: number }, mode: 'push' | 'replace') => {
      const query = new URLSearchParams(window.location.search)
      if (next.search) query.set('q', next.search)
      else query.delete('q')
      if (next.page > 1) query.set('page', String(next.page))
      else query.delete('page')
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
    const timer = setTimeout(() => write({ search: term, page: 1 }, 'replace'), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, search, write])

  const clear = useCallback(() => {
    setDraft('')
    write({ search: '', page: 1 }, 'replace')
  }, [write])

  const goTo = useCallback(
    (next: number) => {
      write({ search, page: next }, 'push')
      // The pages sit under the table, so the next page starts from the top.
      document.documentElement.scrollTop = 0
    },
    [search, write]
  )

  return { search, page, draft, setDraft, clear, goTo }
}
