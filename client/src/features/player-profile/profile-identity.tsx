'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

interface ProfileIdentityProps {
  readonly playerId: string
  readonly name: string
  readonly image: string | null
  /** ISO time the person joined Squadzr. */
  readonly memberSince: string
  readonly compact: boolean
}

/**
 * Who the person is, overlapping the header: the 88px photo (72px in the sheet), the
 * name in display type on one line (the full name in its tooltip) and when they joined.
 */
export function ProfileIdentity({
  playerId,
  name,
  image,
  memberSince,
  compact,
}: ProfileIdentityProps) {
  const t = useTranslations('playerProfile')
  const format = useFormatter()
  const since = new Date(memberSince)
  const date = `${format.dateTime(since, { month: 'short', timeZone: VIEWER_TIME_ZONE })} ${format.dateTime(since, { year: 'numeric', timeZone: VIEWER_TIME_ZONE })}`

  return (
    <div
      className={cn(
        'relative flex',
        compact ? '-mt-12.5 flex-col items-start gap-3 px-4.5' : '-mt-14.5 items-end gap-4 px-6.5'
      )}
    >
      <span className="block shrink-0 rounded-full shadow-[0_0_0_4px_var(--color-panel)]">
        <Avatar size={compact ? 72 : 88} playerId={playerId} name={name} image={image} />
      </span>
      <div className="w-full min-w-0 flex-1">
        <h2
          title={name}
          className={cn(
            'font-display truncate leading-[0.9] font-black tracking-[0.01em] uppercase',
            compact ? 'text-[32px]' : 'text-[40px]'
          )}
        >
          {name}
        </h2>
        <p className="text-muted mt-1 text-[13px] font-medium">{t('memberSince', { date })}</p>
      </div>
    </div>
  )
}
