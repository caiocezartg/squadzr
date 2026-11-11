'use client'

import { useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { auditPageFrom } from './audit-query'

/**
 * The audit page the URL holds as `?page=`, and the command that moves to another one. The write goes
 * through `window.history`, which the App Router follows in `useSearchParams` without a navigation, so
 * no server render runs and the previous page stays on screen while the next one is read. Each move is
 * a history entry, so Back returns to the page before. The first page drops the parameter.
 */
export function useAuditPage(): readonly [number, (page: number) => void] {
  const pathname = usePathname()
  const params = useSearchParams()
  const page = auditPageFrom(params.get('page'))

  const goTo = useCallback(
    (next: number) => {
      const search = new URLSearchParams(window.location.search)
      if (next > 1) search.set('page', String(next))
      else search.delete('page')
      const query = search.toString()
      window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname)
      // The pages sit under the table, so the next page starts from the top.
      document.documentElement.scrollTop = 0
    },
    [pathname]
  )

  return [page, goTo] as const
}
