import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { RealtimeStatus } from '@/lib/ws-client'

interface ConnectionStatusProps {
  status: RealtimeStatus
}

/**
 * The realtime connection, shown only when something is wrong. A live connection is implicit: the
 * roster and readiness update on their own, so nothing marks it. A lost connection reads "Reconnecting…"
 * while it retries, and "Disconnected" once it gives up. "Disconnected" waits for a connection that was
 * open, so a page that has not connected yet never flashes it. In a narrow row the pill is the dot
 * alone, a square like the icon buttons beside it; its text then stays for assistive technology (and as
 * the tooltip), so the colour never stands alone.
 */
export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const t = useTranslations('realtime')
  const [wasOpen, setWasOpen] = useState(false)
  if (status === 'open' && !wasOpen) setWasOpen(true)

  const lost = status === 'closed' && wasOpen
  if (status !== 'reconnecting' && !lost) return null

  const label = lost ? t('disconnected') : t('reconnecting')

  return (
    <span
      role="status"
      title={label}
      className={cn(
        'font-mono inline-flex min-h-11 min-w-11 items-center justify-center gap-2 text-[11.5px] font-bold tracking-[0.08em] whitespace-nowrap uppercase @min-[45rem]:px-3',
        lost ? 'bg-danger-ground text-danger' : 'bg-amber/10 text-amber'
      )}
    >
      <span aria-hidden="true" className="size-1.75 rounded-full bg-current" />
      <span className="sr-only @min-[45rem]:not-sr-only">{label}</span>
    </span>
  )
}
