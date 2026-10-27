import * as m from 'motion/react-m'
import { useTranslations } from 'next-intl'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
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
  const reducedMotion = useReducedMotion()

  return (
    <span
      role="status"
      className={cn(
        'font-ds-mono inline-flex min-h-11 items-center gap-2 px-3 max-[26rem]:px-2.5 text-[11.5px] font-bold tracking-[0.08em] uppercase',
        TONE_CLASSES[status]
      )}
    >
      <m.span
        aria-hidden="true"
        className="size-1.75 rounded-full bg-current"
        animate={live && !reducedMotion ? { opacity: [1, 0.35, 1] } : undefined}
        transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
      />
      {live ? (
        <>
          <span aria-hidden="true" className="max-[26rem]:hidden">
            {t('ds.lobby.live')}
          </span>
          <span className="sr-only">{label}</span>
        </>
      ) : (
        <span className="max-[26rem]:sr-only">{label}</span>
      )}
    </span>
  )
}
