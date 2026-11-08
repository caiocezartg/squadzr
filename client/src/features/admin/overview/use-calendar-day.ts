'use client'

import { useFormatter } from 'next-intl'

export type CalendarDayStyle = 'axis' | 'full'

/**
 * Formats an Activity day (`YYYY-MM-DD`). The day is a calendar day, not an instant, so it is read and
 * written in UTC and never moves to the day before or after in the viewer's time zone. `axis` is the
 * short day and month of the x axis and the tooltip; `full` adds the year, for the table.
 */
export function useCalendarDay(): (day: string, style: CalendarDayStyle) => string {
  const format = useFormatter()

  return (day, style) => {
    const date = new Date(`${day}T00:00:00Z`)
    if (style === 'full') return format.dateTime(date, { dateStyle: 'medium', timeZone: 'UTC' })
    // pt-BR abbreviates the month with a full stop ("5 de nov."), which the axis leaves out.
    return format
      .dateTime(date, { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .replace('.', '')
  }
}
