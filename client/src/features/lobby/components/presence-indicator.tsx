import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/ui/tooltip'

interface PresenceIndicatorProps {
  online: boolean
}

/**
 * Member Presence: color plus text, never color alone. The Online/Offline
 * label is the accessible tooltip of the indicator, revealed on hover and on
 * keyboard focus.
 */
export function PresenceIndicator({ online }: PresenceIndicatorProps) {
  const { t } = useTranslation()
  const label = online ? t('realtime.online') : t('realtime.offline')

  return (
    <Tooltip label={label}>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${online ? 'bg-accent' : 'bg-muted/40'}`}
      />
    </Tooltip>
  )
}
