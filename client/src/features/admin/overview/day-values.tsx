'use client'

import { useFormatter } from 'next-intl'
import type { ActivityRowDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { NoValue } from '../audit/audit-entry-parts'

/** A day's count, or a dash for a day with no data. */
export function DayValue({ value }: { readonly value: number | null }) {
  const format = useFormatter()

  if (value === null) return <NoValue />
  return <>{format.number(value)}</>
}

/**
 * How the day differs from the same day of the previous period, signed, in mint when up and danger when
 * down; a dash when either day has no data.
 */
export function DayDifference({ row }: { readonly row: ActivityRowDto }) {
  const format = useFormatter()

  if (row.current === null || row.previous === null) return <NoValue />
  const difference = row.current - row.previous

  return (
    <span
      className={cn(
        'font-mono text-[11px] font-bold tracking-[0.04em] whitespace-nowrap',
        difference > 0 ? 'text-mint' : difference < 0 ? 'text-danger' : 'text-muted'
      )}
    >
      {format.number(difference, { signDisplay: 'exceptZero' })}
    </span>
  )
}
