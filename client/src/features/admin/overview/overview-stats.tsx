'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { OverviewResponse, PeriodComparisonDto } from '@squadzr/schemas'
import { ChangeBadge } from './change-badge'
import { StatTile } from './stat-tile'

/**
 * A tile's period line: how many joined the total in the period, the figure in bold (mint when the
 * period brought any), and the change against before.
 */
function PeriodLine({
  comparison,
  period,
}: {
  readonly comparison: PeriodComparisonDto
  readonly period: number
}) {
  const t = useTranslations('admin.overview.stats')
  const tone = comparison.current > 0 ? 'text-mint' : 'text-text-2'

  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span>
        {t.rich('inPeriod', {
          count: comparison.current,
          figure: (figure) => <strong className={`font-bold ${tone}`}>{figure}</strong>,
        })}
      </span>
      <ChangeBadge current={comparison.current} previous={comparison.previous} period={period} />
    </span>
  )
}

/**
 * The Overview's four numbers (reference, Admin panel, Overview), in one hairline box: four across,
 * two by two below 900px. Online users and Open Squads are live counts; registered users and completed
 * Squads add what the period brought.
 */
export function OverviewStats({ overview }: { readonly overview: OverviewResponse }) {
  const t = useTranslations('admin.overview.stats')
  const format = useFormatter()
  const { live, metrics, period } = overview

  return (
    <dl className="bg-line grid grid-cols-2 gap-px p-px min-[900px]:grid-cols-4">
      <StatTile label={t('online')} value={format.number(live.onlineUsers)} live>
        {t('onlineNow')}
      </StatTile>
      <StatTile label={t('users')} value={format.number(live.totalUsers)}>
        <PeriodLine comparison={metrics.signups} period={period} />
      </StatTile>
      <StatTile label={t('open')} value={format.number(live.openSquads)}>
        {t('openNow')}
      </StatTile>
      <StatTile label={t('completed')} value={format.number(live.completedSquads)}>
        <PeriodLine comparison={metrics.completed} period={period} />
      </StatTile>
    </dl>
  )
}
