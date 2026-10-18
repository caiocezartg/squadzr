import { useFormatter, useNow, useTranslations } from 'next-intl'

/** The relative wording only changes at minute boundaries, so the reference time ticks once a minute. */
const NOW_UPDATE_INTERVAL_MS = 60_000

/**
 * The viewer's own zone. next-intl reports a date formatted without one, and these dates have always
 * been the browser's local dates, so the zone is passed explicitly.
 */
const VIEWER_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone

type TimeAgoKey = 'timeAgo.justNow' | 'timeAgo.minutesAgo' | 'timeAgo.hoursAgo' | 'timeAgo.daysAgo'
type Translate = (key: TimeAgoKey, values?: { count: number }) => string
type Format = ReturnType<typeof useFormatter>

function getTimeAgo(date: Date, now: Date, t: Translate, format: Format): string {
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return t('timeAgo.justNow')
  if (diffMin < 60) return t('timeAgo.minutesAgo', { count: diffMin })
  if (diffHour < 24) return t('timeAgo.hoursAgo', { count: diffHour })
  if (diffDay < 7) return t('timeAgo.daysAgo', { count: diffDay })
  return format.dateTime(date, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: VIEWER_TIME_ZONE,
  })
}

/**
 * The relative time of `date` against the reference time next-intl hands over from the server, and
 * formatted in the active locale once it is a week old.
 */
export function useTimeAgo(date: Date | string | undefined): string {
  const t = useTranslations()
  const format = useFormatter()
  const now = useNow({ updateInterval: NOW_UPDATE_INTERVAL_MS })

  if (!date) return ''
  return getTimeAgo(new Date(date), now, t, format)
}
