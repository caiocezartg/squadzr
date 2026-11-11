'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { AdminSquadDto } from '@squadzr/schemas'
import { SlotMeter } from '@/components/ds/slot-meter'
import { useTimeAgo, VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

/** The Game's poster, beside a Squad's name. */
export function SquadThumb({
  url,
  large = false,
}: {
  readonly url: string
  readonly large?: boolean
}) {
  return (
    <img
      src={url}
      alt=""
      className={cn('bg-raised-2 block shrink-0 object-cover', large ? 'h-16 w-12' : 'h-10 w-7.5')}
    />
  )
}

/** "Game · Platform" of a Squad, the platform left out when it has none. */
export function useSquadMeta(squad: Pick<AdminSquadDto, 'game' | 'platform'>): string {
  const t = useTranslations()
  return squad.platform
    ? `${squad.game.name} · ${t(`platforms.${squad.platform}`)}`
    : squad.game.name
}

/** The taken slots as a meter, with the count as its text. */
export function SquadSlots({
  squad,
}: {
  readonly squad: Pick<AdminSquadDto, 'memberCount' | 'maxPlayers'>
}) {
  const t = useTranslations('admin.squads')

  return (
    <span className="flex items-center gap-2">
      <SlotMeter filled={squad.memberCount} total={squad.maxPlayers} variant="pips" />
      <span className="type-code text-text-2 whitespace-nowrap">
        <span aria-hidden="true">
          {squad.memberCount}/{squad.maxPlayers}
        </span>
        <span className="sr-only">
          {t('slotsLabel', { count: squad.memberCount, max: squad.maxPlayers })}
        </span>
      </span>
    </span>
  )
}

/** A moment as the relative time, with the full date and time as its tooltip. */
export function RelativeTime({ at }: { readonly at: string }) {
  const format = useFormatter()
  const timeAgo = useTimeAgo(at)
  const absolute = format.dateTime(new Date(at), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VIEWER_TIME_ZONE,
  })

  return (
    <time dateTime={at} title={absolute} className="whitespace-nowrap">
      {timeAgo}
    </time>
  )
}
