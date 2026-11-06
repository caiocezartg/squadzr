'use client'

import { useFormatter } from 'next-intl'
import type { ActivityRowDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { labelledIndexes, labelStep, Y_STEPS, yAt } from './chart-scale'
import { useCalendarDay } from './use-calendar-day'

const AXIS_TEXT = 'font-mono text-faint text-[10.5px] font-bold whitespace-nowrap'

/** The y axis's values, right-aligned in the gutter left of the chart, one per grid line. */
export function YAxisLabels({ step }: { readonly step: number }) {
  const format = useFormatter()

  return (
    <div aria-hidden="true" className="absolute top-0 left-0 h-60 w-7.5 sm:w-10">
      {Array.from({ length: Y_STEPS + 1 }, (_, level) => (
        <span
          key={level}
          style={{ top: yAt(level * step, step * Y_STEPS) }}
          className={cn(AXIS_TEXT, 'absolute right-1.5 -translate-y-1/2')}
        >
          {format.number(level * step)}
        </span>
      ))}
    </div>
  )
}

/** One set of dates under the x axis: every `step`th day back from the latest. */
function XLabelSet({
  rows,
  step,
  className,
}: {
  readonly rows: readonly ActivityRowDto[]
  readonly step: number
  readonly className: string
}) {
  const calendarDay = useCalendarDay()
  const last = rows.length - 1

  return (
    <div aria-hidden="true" className={cn('relative mt-1.5 h-6', className)}>
      {labelledIndexes(rows.length, step).map((index) => (
        <span
          key={index}
          style={{ left: last > 0 ? `${(index / last) * 100}%` : '50%' }}
          className={cn(
            AXIS_TEXT,
            'absolute',
            index === last ? '-translate-x-full' : index === 0 ? '' : '-translate-x-1/2'
          )}
        >
          {calendarDay(rows[index]?.date ?? '', 'axis')}
        </span>
      ))}
    </div>
  )
}

/**
 * The dates under the chart, thinned so they never touch: a narrow chart (below 640px) labels fewer
 * days. Both sets are in the HTML, so the server render fits every width; CSS shows one.
 */
export function XAxisLabels({
  rows,
  period,
}: {
  readonly rows: readonly ActivityRowDto[]
  readonly period: number
}) {
  return (
    <>
      <XLabelSet rows={rows} step={labelStep(period, false)} className="hidden sm:block" />
      <XLabelSet rows={rows} step={labelStep(period, true)} className="sm:hidden" />
    </>
  )
}
