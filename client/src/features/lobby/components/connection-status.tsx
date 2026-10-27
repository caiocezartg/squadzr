import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
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

const TONE_CLASSES: Record<RealtimeStatus, string> = {
  connecting: 'bg-amber/10 text-amber',
  open: 'bg-mint/8 text-mint',
  reconnecting: 'bg-amber/10 text-amber',
  closed: 'bg-danger-ground text-ds-danger',
}

/**
 * The overall realtime connection (reference, Lobby): "LIVE" with a pulsing dot while connected, and the
 * state's own words otherwise. Every state has its text, so the colour is never alone.
 */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const t = useTranslations()
  const label = t(LABEL_KEYS[status])
  const live = status === 'open'

  return (
    <span
      role="status"
      className={cn(
        'font-ds-mono inline-flex min-h-11 items-center gap-2 px-3 text-[11.5px] font-bold tracking-[0.08em] uppercase',
        TONE_CLASSES[status]
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.75 rounded-full bg-current',
          live && 'animate-pulse [animation-duration:1.6s] motion-reduce:animate-none'
        )}
      />
      {live ? (
        <>
          <span aria-hidden="true">{t('ds.lobby.live')}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        label
      )}
    </span>
  )
}
