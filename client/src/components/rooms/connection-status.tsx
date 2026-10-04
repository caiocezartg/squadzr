import { useTranslation } from 'react-i18next'
import type { RealtimeStatus } from '@/lib/ws-client'

interface ConnectionStatusProps {
  status: RealtimeStatus
}

const LABEL_KEYS = {
  connecting: 'realtime.connecting',
  open: 'realtime.connected',
  reconnecting: 'realtime.reconnecting',
  closed: 'realtime.disconnected',
} as const satisfies Record<RealtimeStatus, string>

const DOT_CLASSES: Record<RealtimeStatus, string> = {
  connecting: 'bg-amber-400',
  open: 'bg-accent',
  reconnecting: 'bg-amber-400',
  closed: 'bg-danger',
}

/** Overall realtime connection state: color, accessible text and tooltip. */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { t } = useTranslation()
  const label = t(LABEL_KEYS[status])

  return (
    <span className="inline-flex items-center" title={label}>
      <span aria-hidden="true" className={`size-2 rounded-full ${DOT_CLASSES[status]}`} />
      <span className="sr-only">{label}</span>
    </span>
  )
}
