'use client'

import type { CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import type { PlayerProfileDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'

/** The first bar starts this long after the dialog begins to open, and each next one 40ms after it. */
const BARS_START_MS = 100
const BAR_STAGGER_MS = 40

interface TopGamesProps {
  readonly topGames: PlayerProfileDto['topGames']
  readonly compact: boolean
}

/**
 * The most played Games, ranked, each with a bar sized against the first and its Squad count. The bars
 * grow from the left (`starting:`) when the list first appears, not when a background read refreshes
 * it, and not at all under reduced motion (the global rule drops the transform transition).
 */
export function TopGames({ topGames, compact }: TopGamesProps) {
  const t = useTranslations('playerProfile.topGames')
  const leader = topGames[0]?.squads ?? 1

  return (
    <section
      aria-labelledby="player-profile-top-games"
      className={cn(compact ? 'px-4.5 pt-4.5 pb-5' : 'px-6.5 pt-5.5 pb-6.5')}
    >
      <div className="type-label text-muted flex justify-between">
        <h3 id="player-profile-top-games" className="type-label">
          {t('title')}
        </h3>
        <span className="text-faint" aria-hidden>
          {t('unit')}
        </span>
      </div>
      <ol className="mt-1.5">
        {topGames.map(({ game, squads }, index) => (
          <li
            key={game.id}
            className={cn(
              'grid items-center gap-3 py-2.25',
              compact ? 'grid-cols-[30px_1fr_auto]' : 'grid-cols-[22px_38px_1fr_auto]',
              index > 0 && 'shadow-[inset_0_1px_0_#16171b]'
            )}
          >
            {!compact && (
              <span
                className="text-faint font-mono text-[11px] font-bold"
                aria-label={t('rank', { rank: index + 1 })}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
            )}
            <img
              src={game.coverThumbUrl}
              alt=""
              className={cn(
                'bg-raised-2 block object-cover',
                compact ? 'h-10 w-7.5' : 'h-12.75 w-9.5'
              )}
            />
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-extrabold" title={game.name}>
                {game.name}
              </p>
              <div className="bg-track mt-2.25 h-1" aria-hidden>
                <div
                  className={cn(
                    'bg-mint starting:scale-x-0 h-full origin-left scale-x-(--ratio) transition-transform duration-500 ease-out',
                    index > 0 && 'opacity-38'
                  )}
                  style={
                    {
                      '--ratio': squads / leader,
                      transitionDelay: `${BARS_START_MS + index * BAR_STAGGER_MS}ms`,
                    } as CSSProperties
                  }
                />
              </div>
            </div>
            <span className="font-display min-w-11 text-right text-[22px] leading-none font-extrabold">
              {squads}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
