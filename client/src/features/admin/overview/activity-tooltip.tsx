'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { ActivityRowDto } from '@squadzr/schemas'
import { DayDifference, DayValue } from './day-values'
import { CurrentSwatch, PreviousSwatch } from './series-swatch'
import { useCalendarDay } from './use-calendar-day'

interface ActivityTooltipProps {
  readonly row: ActivityRowDto
  /** Where the crosshair stands, as a percentage of the chart's width. */
  readonly left: number
}

/**
 * The card beside the crosshair (reference, Admin panel, Overview): the day, both periods' counts and
 * their difference. It sits right of the crosshair on the chart's left half and left of it on the right
 * half, so it never leaves the chart. It is announced as it changes, for keyboard use.
 */
export function ActivityTooltip({ row, left }: ActivityTooltipProps) {
  const t = useTranslations('admin.overview.activity')
  const calendarDay = useCalendarDay()
  const side =
    left > 50 ? { right: `calc(${100 - left}% + 14px)` } : { left: `calc(${left}% + 14px)` }

  return (
    <div
      role="status"
      style={side}
      className="bg-raised text-text-2 pointer-events-none absolute top-2 z-10 min-w-45 px-3 py-2.5 text-[12.5px] font-medium shadow-[0_0_0_1px_var(--color-track),0_12px_30px_rgba(0,0,0,0.5)]"
    >
      <p className="type-label text-muted mb-1.5 text-[10px]">{calendarDay(row.date, 'axis')}</p>
      <TooltipLine label={t('current')} swatch={<CurrentSwatch />}>
        <DayValue value={row.current} />
      </TooltipLine>
      <TooltipLine label={t('previous')} swatch={<PreviousSwatch />}>
        <DayValue value={row.previous} />
      </TooltipLine>
      <p className="mt-0.75 flex items-center justify-between gap-3.5">
        <span>{t('difference')}</span>
        <DayDifference row={row} />
      </p>
    </div>
  )
}

function TooltipLine({
  label,
  swatch,
  children,
}: {
  readonly label: string
  readonly swatch: ReactNode
  readonly children: ReactNode
}) {
  return (
    <p className="mt-0.75 flex items-center justify-between gap-3.5">
      <span className="flex items-center gap-1.5">
        {swatch}
        {label}
      </span>
      <span className="font-display text-text text-[15px] font-extrabold">{children}</span>
    </p>
  )
}
