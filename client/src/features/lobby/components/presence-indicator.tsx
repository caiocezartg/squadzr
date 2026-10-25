import { useTranslations } from 'next-intl'
import { Tooltip } from '@/components/ui/tooltip'
import { useTimeAgo } from '@/hooks/use-time-ago'

interface PresenceIndicatorProps {
  online: boolean
  /** ISO time the member went offline; null when the server has no known time. */
  offlineSince: string | null
}

/**
 * Member Presence: color plus text, never color alone. The Online/Offline
 * label is the accessible tooltip of the indicator, revealed on hover and on
 * keyboard focus. An offline member with a known time reads "Offline · 3m ago".
 */
export function PresenceIndicator({ online, offlineSince }: PresenceIndicatorProps) {
  const t = useTranslations()
  const timeAgo = useTimeAgo(offlineSince ?? undefined)
  const offlineLabel = timeAgo
    ? t('realtime.offlineSince', { time: timeAgo })
    : t('realtime.offline')
  const label = online ? t('realtime.online') : offlineLabel

  return (
    <Tooltip label={label}>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${online ? 'bg-accent' : 'bg-muted/40'}`}
      />
    </Tooltip>
  )
}
