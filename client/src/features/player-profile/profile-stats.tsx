'use client'

import { useTranslations } from 'next-intl'
import type { PlayerProfileDto } from '@squadzr/schemas'
import { useTimeAgo } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

interface ProfileStatsProps {
  readonly profile: Pick<PlayerProfileDto, 'completedSquads' | 'gamesPlayed' | 'lastSquad'>
  readonly compact: boolean
}

const CELL = 'min-w-0 px-4 py-3.5'
const LABEL = 'type-label text-muted'

/**
 * The three numbers under the identity: completed Squads, Games, and the last Squad. In the sheet the
 * last Squad takes a row of its own.
 */
export function ProfileStats({ profile, compact }: ProfileStatsProps) {
  const t = useTranslations('playerProfile.stats')
  const value = cn(
    'font-display mt-2 leading-none font-extrabold',
    compact ? 'text-[28px]' : 'text-[34px]'
  )

  return (
    <dl
      className={cn(
        'grid shadow-[inset_0_0_0_1px_var(--color-line)]',
        compact ? 'mx-4.5 mt-4 grid-cols-2' : 'mx-6.5 mt-5.5 grid-cols-[1fr_1fr_1.5fr]'
      )}
    >
      <div className={CELL}>
        <dt className={LABEL}>{t('squads')}</dt>
        <dd className={value}>
          {profile.completedSquads}
          <small className="text-text-3 font-body ml-1 text-[13px] font-bold">
            {t('completed')}
          </small>
        </dd>
      </div>
      <div className={cn(CELL, 'shadow-[inset_1px_0_0_var(--color-line)]')}>
        <dt className={LABEL}>{t('games')}</dt>
        <dd className={value}>{profile.gamesPlayed}</dd>
      </div>
      <div
        className={cn(
          CELL,
          compact
            ? 'col-span-2 shadow-[inset_0_1px_0_var(--color-line)]'
            : 'shadow-[inset_1px_0_0_var(--color-line)]'
        )}
      >
        <dt className={LABEL}>{t('lastSquad')}</dt>
        <dd>{profile.lastSquad && <LastSquad lastSquad={profile.lastSquad} />}</dd>
      </div>
    </dl>
  )
}

function LastSquad({
  lastSquad,
}: {
  readonly lastSquad: NonNullable<PlayerProfileDto['lastSquad']>
}) {
  const timeAgo = useTimeAgo(lastSquad.readyAt)

  return (
    <div className="mt-2 flex items-center gap-2.5">
      <img
        src={lastSquad.game.coverThumbUrl}
        alt=""
        className="bg-raised-2 h-8.75 w-6.5 shrink-0 object-cover"
      />
      <div className="min-w-0">
        <b className="block truncate text-sm font-extrabold" title={lastSquad.game.name}>
          {lastSquad.game.name}
        </b>
        <span className="text-muted text-xs font-medium">{timeAgo}</span>
      </div>
    </div>
  )
}
