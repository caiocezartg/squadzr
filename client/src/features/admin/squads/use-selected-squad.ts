'use client'

import { useCallback, useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { adminSquadIdParamSchema } from '@squadzr/schemas'

/** The URL parameter that holds the Squad whose side panel is open. */
export const SQUAD_PARAM = 'squad'

export interface SelectedSquad {
  /** The Squad the URL's `?squad=` names, or `null` when no panel is open. */
  readonly squadId: string | null
  /** Opens a Squad's panel as a new history entry, so Back closes it. */
  readonly open: (id: string) => void
  /** Closes the panel: back to the entry it opened from, or the same list without `?squad=`. */
  readonly close: () => void
}

/**
 * The Squad whose side panel is open, held in the URL as `?squad=<id>` next to the list's filters. An
 * id that is not a Squad id opens nothing. A panel this page opened goes back in history on close, so
 * the list's entry is not doubled; a panel the URL opened (a shared link) drops the parameter instead.
 */
export function useSelectedSquad(): SelectedSquad {
  const pathname = usePathname()
  const router = useRouter()
  const params = useSearchParams()
  const parsed = adminSquadIdParamSchema.shape.id.safeParse(params.get(SQUAD_PARAM))
  const squadId = parsed.success ? parsed.data : null
  const pushed = useRef(false)

  // Back (or any URL change) that closed the panel leaves no entry of this page's to go back from.
  useEffect(() => {
    if (squadId === null) pushed.current = false
  }, [squadId])

  const open = useCallback(
    (id: string) => {
      const query = new URLSearchParams(window.location.search)
      query.set(SQUAD_PARAM, id)
      window.history.pushState(null, '', `${pathname}?${query.toString()}`)
      pushed.current = true
    },
    [pathname]
  )

  const close = useCallback(() => {
    if (pushed.current) {
      pushed.current = false
      router.back()
      return
    }
    const query = new URLSearchParams(window.location.search)
    query.delete(SQUAD_PARAM)
    const value = query.toString()
    window.history.replaceState(null, '', value ? `${pathname}?${value}` : pathname)
  }, [pathname, router])

  return { squadId, open, close }
}
