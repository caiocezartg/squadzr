import { useTranslation } from 'react-i18next'

interface PresenceIndicatorProps {
  online: boolean
}

/**
 * Member Presence: color plus text, never color alone. The label is exposed to
 * assistive technology and as the tooltip of the indicator.
 */
export function PresenceIndicator({ online }: PresenceIndicatorProps) {
  const { t } = useTranslation()
  const label = online ? t('realtime.online') : t('realtime.offline')

  return (
    <span className="inline-flex shrink-0 items-center" title={label}>
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${online ? 'bg-accent' : 'bg-muted/40'}`}
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
