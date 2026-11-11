'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { ActivityRowDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { NoValue } from '../shared/no-value'

/** A day's count, or "no data" for a day with none (a sampled metric before its sampler ran). */
export function DayValue({ value }: { readonly value: number | null }) {
  const t = useTranslations('admin.overview.activity')
  const format = useFormatter()

  if (value === null)
    return (
      <span className="text-faint font-body text-xs font-medium whitespace-nowrap">
        {t('noData')}
      </span>
    )
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
