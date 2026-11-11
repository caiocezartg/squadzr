'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { Platform } from '@squadzr/schemas'
import { Tag } from '@/components/ds/tag'
import { cn } from '@/lib/utils'
import { NoValue } from '../../shared/no-value'

const PILL =
  'type-label inline-flex items-center gap-1.5 px-2 py-1 text-[10.5px] tracking-[0.12em] whitespace-nowrap'

/** Whether players can pick the game: a mint "Listed" pill, or a muted "Delisted" one. */
export function GameStatusBadge({ listed }: { readonly listed: boolean }) {
  const t = useTranslations('admin.catalog.games.badges')

  return (
    <span className={cn(PILL, listed ? 'bg-mint/8 text-mint' : 'bg-raised-2 text-text-2')}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {t(listed ? 'listed' : 'delisted')}
    </span>
  )
}

/** The amber "Featured #n" pill of a game with a featured rank. */
export function FeaturedBadge({ rank }: { readonly rank: number }) {
  const t = useTranslations('admin.catalog.games.badges')

  return <span className={cn(PILL, 'bg-amber/10 text-amber')}>{t('featured', { rank })}</span>
}

/** The platforms the game runs on, as the board's platform chips, or a dash when it has none. */
export function GamePlatforms({ platforms }: { readonly platforms: readonly Platform[] }) {
  const t = useTranslations('platforms')

  if (platforms.length === 0) return <NoValue />
  return (
    <span className="flex flex-wrap gap-1">
      {platforms.map((platform) => (
        <Tag key={platform} variant="platform" platform={platform} label={t(platform)} />
      ))}
    </span>
  )
}

/** How many players a Squad of the game holds, as "2–5". */
export function GamePlayers({ min, max }: { readonly min: number; readonly max: number }) {
  const t = useTranslations('admin.catalog.games')

  return (
    <span className="tabular-nums whitespace-nowrap">
      {min === max ? min : t('players', { min, max })}
    </span>
  )
}

/** The featured rank as "#3", or a dash when the game is not featured. */
export function FeaturedRank({ rank }: { readonly rank: number | null }) {
  const t = useTranslations('admin.catalog.games')

  if (rank === null) return <NoValue />
  return <span className="tabular-nums">{t('featuredRank', { rank })}</span>
}

/** A count in the viewer's number format. */
export function GameCount({ value }: { readonly value: number }) {
  const format = useFormatter()
  return <span className="tabular-nums">{format.number(value)}</span>
}

/** The game's full cover, at the head of its page. */
export function GameCover({ url }: { readonly url: string }) {
  return (
    <img
      src={url}
      alt=""
      className="bg-raised-2 block h-32 w-24 shrink-0 object-cover sm:h-40 sm:w-30"
    />
  )
}
