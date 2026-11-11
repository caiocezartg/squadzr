'use client'

import { useTranslations } from 'next-intl'
import type { ActivityRowDto } from '@squadzr/schemas'
import { DayDifference, DayValue } from './day-values'
import { useCalendarDay } from './use-calendar-day'

const HEADER_CELL = 'type-label text-faint bg-panel sticky top-0 px-3 pb-2.5 whitespace-nowrap'
const CELL = 'px-3 py-2.5 align-middle shadow-[inset_0_1px_0_#16171b]'

interface ActivityTableProps {
  readonly rows: readonly ActivityRowDto[]
  /** What the table lists, read as its caption. */
  readonly caption: string
}

/**
 * The chart's days as a table: the date, the period's count, the previous period's and the difference,
 * newest first. It scrolls inside the panel at the chart's height, and the scroll box takes keyboard
 * focus so the keys can scroll it.
 */
export function ActivityTable({ rows, caption }: ActivityTableProps) {
  const t = useTranslations('admin.overview.activity')
  const calendarDay = useCalendarDay()

  return (
    <div
      role="region"
      tabIndex={0}
      aria-label={caption}
      className="scrollbar-thin focus-visible:outline-text max-h-[270px] overflow-y-auto focus-visible:outline-2"
    >
      <table className="w-full border-collapse text-[13.5px] font-medium">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${HEADER_CELL} text-left`}>
              {t('columns.date')}
            </th>
            <th scope="col" className={`${HEADER_CELL} text-right`}>
              {t('current')}
            </th>
            <th scope="col" className={`${HEADER_CELL} text-right`}>
              {t('previous')}
            </th>
            <th scope="col" className={`${HEADER_CELL} text-right`}>
              {t('difference')}
            </th>
          </tr>
        </thead>
        <tbody className="text-text-2 tabular-nums">
          {[...rows].reverse().map((row) => (
            <tr key={row.date}>
              <th scope="row" className={`${CELL} text-text-2 text-left font-medium`}>
                <time dateTime={row.date}>{calendarDay(row.date, 'full')}</time>
              </th>
              <td className={`${CELL} text-text text-right font-bold`}>
                <DayValue value={row.current} />
              </td>
              <td className={`${CELL} text-right`}>
                <DayValue value={row.previous} />
              </td>
              <td className={`${CELL} text-right`}>
                <DayDifference row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
