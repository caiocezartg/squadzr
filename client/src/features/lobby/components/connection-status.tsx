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
  closed: 'bg-danger-ground text-danger',
}

/**
 * The overall realtime connection (reference, Lobby): "LIVE" with a pulsing dot while connected, and the
 * state's own words otherwise. In a narrow row the pill is the dot alone, a square like the icon buttons
 * beside it; its text then stays for assistive technology (and as the tooltip), so the colour never
 * stands alone.
 */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const t = useTranslations()
  const label = t(LABEL_KEYS[status])
  const live = status === 'open'

  return (
    <span
      role="status"
      title={label}
      className={cn(
        'font-mono inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-[11.5px] font-bold tracking-[0.08em] whitespace-nowrap uppercase',
        live ? '@min-[41rem]:px-3' : '@min-[45rem]:px-3',
        TONE_CLASSES[status]
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.75 rounded-full bg-current',
          live && 'motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]'
        )}
      />
      {live ? (
        <>
          <span aria-hidden="true" className="hidden @min-[41rem]:inline">
            {t('ds.lobby.live')}
          </span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <span className="sr-only @min-[45rem]:not-sr-only">{label}</span>
      )}
    </span>
  )
}
