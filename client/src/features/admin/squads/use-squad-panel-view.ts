'use client'

import { useMemo, useState } from 'react'
import type { AdminSquadDetailDto, AdminSquadDto } from '@squadzr/schemas'
import { ApiClientError } from '@/lib/api-contract'
import { useAdminSquad } from './squads-query'

/** What the side panel shows. */
export type SquadPanelView =
  /** The detail: roster, language and invite. */
  | { readonly kind: 'detail'; readonly squad: AdminSquadDetailDto }
  /** The list row, while the detail is read for the first time. */
  | { readonly kind: 'row'; readonly squad: AdminSquadDto }
  /** Neither yet: a Squad the URL opened before the list holds it. */
  | { readonly kind: 'loading' }
  /** The Squad is no longer open. */
  | { readonly kind: 'gone' }
  | { readonly kind: 'error' }

export interface SquadPanelState {
  /** The view of the open Squad, or of the last one while the panel slides out; `null` before any. */
  readonly view: SquadPanelView | null
  readonly retry: () => void
}

/**
 * The open Squad's panel content: its detail once read (at once from the cache), else the list's row as
 * an instant placeholder, else the loading state; a 404 is a Squad that closed meanwhile. While the panel
 * leaves, the last view stays, so the exit does not empty it.
 */
export function useSquadPanelView(
  squadId: string | null,
  row: AdminSquadDto | null
): SquadPanelState {
  const detail = useAdminSquad(squadId)
  const { data, error, refetch } = detail

  const view = useMemo<SquadPanelView | null>(() => {
    if (squadId === null) return null
    // A read again that found the Squad gone outranks the detail an earlier read left in the cache.
    if (error instanceof ApiClientError && error.status === 404) return { kind: 'gone' }
    if (data) return { kind: 'detail', squad: data.squad }
    if (error) return { kind: 'error' }
    if (row) return { kind: 'row', squad: row }
    return { kind: 'loading' }
  }, [squadId, data, error, row])

  return { view: useLastWhileClosing(view), retry: () => void refetch() }
}

/** `value`, or the last non-null one while it is `null`. */
function useLastWhileClosing<T>(value: T | null): T | null {
  const [last, setLast] = useState(value)
  if (value !== null && value !== last) setLast(value)
  return value ?? last
}
