'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { periodChange, type PeriodChange } from './period-change'

interface ChangeBadgeProps {
  readonly current: number
  readonly previous: number
  /** The length of both periods, in days. */
  readonly period: number
  /** Where the comparison is written out: always, or from the sm width up (read aloud below it). */
  readonly versus?: 'always' | 'from-sm'
  readonly className?: string
}

interface ChangeView {
  readonly tone: string
  /** The arrow or dash on screen, which the spoken word replaces. */
  readonly mark: string
  readonly spoken: string
  readonly value: string | null
}

function useChangeView(): (change: PeriodChange) => ChangeView {
  const t = useTranslations('admin.overview.change')
  const format = useFormatter()
  const percent = (ratio: number) =>
    format.number(ratio, { style: 'percent', maximumFractionDigits: 0 })

  return (change) => {
    switch (change.trend) {
      case 'up':
        return { tone: 'text-mint', mark: '▲', spoken: t('up'), value: percent(change.ratio) }
      case 'down':
        return { tone: 'text-danger', mark: '▼', spoken: t('down'), value: percent(change.ratio) }
      case 'flat':
        return { tone: 'text-muted', mark: '', spoken: t('flat'), value: percent(0) }
      case 'new':
        return { tone: 'text-mint', mark: '▲', spoken: '', value: t('new') }
      case 'none':
        return { tone: 'text-muted', mark: '—', spoken: t('none'), value: null }
    }
  }
}

/**
 * A total's change against the previous period (reference, Admin panel, Overview): ▲ in mint or ▼ in
 * danger with the percentage, "new" when the previous period had none and a neutral dash when neither
 * had any, then what it compares with, which a tile on a phone leaves to screen readers.
 */
export function ChangeBadge({
  current,
  previous,
  period,
  versus = 'always',
  className,
}: ChangeBadgeProps) {
  const t = useTranslations('admin.overview.change')
  const view = useChangeView()(periodChange(current, previous))

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <span
        className={cn(
          'font-mono text-[11px] font-bold tracking-[0.04em] whitespace-nowrap',
          view.tone
        )}
      >
        {view.mark && <span aria-hidden="true">{view.mark} </span>}
        {view.spoken && <span className="sr-only">{view.spoken} </span>}
        {view.value}
      </span>
      <span
        className={cn(
          'text-muted text-xs whitespace-nowrap',
          versus === 'from-sm' && 'max-sm:sr-only'
        )}
      >
        {t('versus', { count: period })}
      </span>
    </span>
  )
}
