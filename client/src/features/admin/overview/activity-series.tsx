'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { ActivityMetric, ActivityResponse } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { NoValue } from '../shared/no-value'
import { ActivityChart } from './activity-chart'
import { isPeakMetric, seriesSummary } from './activity-summary'
import { ActivityTable } from './activity-table'
import { ChangeBadge } from './change-badge'
import { CurrentSwatch, PreviousSwatch } from './series-swatch'

interface ActivitySeriesProps {
  readonly data: ActivityResponse
  readonly view: 'chart' | 'table'
  /** What the series counts, which names the table. */
  readonly caption: string
  /** The series is the previous metric's or period's while the new one is read. */
  readonly busy: boolean
}

/** The period's figure: a count's total, a peak's highest day followed by the word, or a dash. */
function SummaryFigure({
  metric,
  value,
}: {
  readonly metric: ActivityMetric
  readonly value: number | null
}) {
  const t = useTranslations('admin.overview.activity')
  const format = useFormatter()

  if (value === null) return <NoValue />
  if (isPeakMetric(metric)) return <>{t('peakTotal', { value: format.number(value) })}</>
  return <>{format.number(value)}</>
}

/**
 * One metric's series: its total over the period (or, for a sampled metric, its peak) with the change
 * against the previous period, the legend naming both lines, and the chart or the table of the days.
 */
export function ActivitySeries({ data, view, caption, busy }: ActivitySeriesProps) {
  const t = useTranslations('admin.overview.activity')
  const current = seriesSummary(
    data.metric,
    data.rows.map((row) => row.current)
  )
  const previous = seriesSummary(
    data.metric,
    data.rows.map((row) => row.previous)
  )

  return (
    <div aria-busy={busy} className={cn('motion-safe:transition-opacity', busy && 'opacity-60')}>
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3">
        <p className="flex flex-wrap items-baseline gap-2.5">
          <span className="font-display text-[40px] leading-none font-extrabold tabular-nums">
            <SummaryFigure metric={data.metric} value={current} />
          </span>
          <ChangeBadge current={current} previous={previous} period={data.period} />
        </p>
        <ul className="text-text-3 flex flex-wrap gap-x-4.5 gap-y-1 text-xs font-bold">
          <li className="flex items-center gap-2">
            <CurrentSwatch className="w-4.5" />
            {t('legend.current', { count: data.period })}
          </li>
          <li className="flex items-center gap-2">
            <PreviousSwatch className="w-4.5" />
            {t('legend.previous', { count: data.period })}
          </li>
        </ul>
      </div>
      {view === 'chart' ? (
        <ActivityChart rows={data.rows} period={data.period} metric={data.metric} />
      ) : (
        <ActivityTable rows={data.rows} caption={caption} />
      )}
    </div>
  )
}
