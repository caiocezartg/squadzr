'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { PeakComparisonDto } from '@squadzr/schemas'
import { NoValue } from '../shared/no-value'
import { ChangeBadge } from './change-badge'

/**
 * A live tile's peak line (reference, Admin panel, Overview): the highest sampled count of the period,
 * the figure in bold, and the change against the period before; a dash and no change when the period
 * has no samples. On a phone, two lines: the figure, then the change.
 */
export function PeakLine({
  comparison,
  period,
}: {
  readonly comparison: PeakComparisonDto
  readonly period: number
}) {
  const t = useTranslations('admin.overview.stats')
  const format = useFormatter()
  const { current, previous } = comparison

  return (
    <span className="flex flex-col gap-0.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-1.5">
      <span>
        {t.rich('peak', {
          value: current === null ? '' : format.number(current),
          figure: (figure) => (
            <strong className="text-text-2 font-bold">
              {current === null ? <NoValue /> : figure}
            </strong>
          ),
        })}
      </span>
      {current !== null && (
        <ChangeBadge current={current} previous={previous} period={period} versus="from-sm" />
      )}
    </span>
  )
}
