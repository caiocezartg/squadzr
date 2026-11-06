'use client'

import { useCallback } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { DEFAULT_OVERVIEW_PERIOD, type OverviewPeriod } from '@squadzr/schemas'
import { overviewPeriodFrom } from './overview-query'

/**
 * The period the URL holds as `?period=`, and the command that moves to another one. Like the Audit
 * page, the write goes through `window.history`, which the App Router follows in `useSearchParams`
 * without a navigation, so no server render runs and the previous numbers stay on screen while the new
 * ones are read. Each move is a history entry. The default period drops the parameter.
 */
export function useOverviewPeriod(): readonly [OverviewPeriod, (period: OverviewPeriod) => void] {
  const pathname = usePathname()
  const params = useSearchParams()
  const period = overviewPeriodFrom(params.get('period'))

  const select = useCallback(
    (next: OverviewPeriod) => {
      const search = new URLSearchParams(window.location.search)
      if (next === DEFAULT_OVERVIEW_PERIOD) search.delete('period')
      else search.set('period', String(next))
      const query = search.toString()
      window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname)
    },
    [pathname]
  )

  return [period, select] as const
}
