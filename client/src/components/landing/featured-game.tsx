import { useId, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { Tag } from '@/components/ds/tag'
import { cn } from '@/lib/utils'
import type { PopularGame } from '@/types'
import { gameRange, gameSquadsHref } from './game-range'

interface FeaturedGameProps {
  /** Every game of the list: their covers sit stacked, so a new feature crossfades with no load. */
  readonly games: readonly PopularGame[]
  readonly featured: PopularGame
}

function Stat({ term, children }: { readonly term: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 bg-[#191A1F] px-4 py-3.5">
      <dt className="type-label text-ds-muted tracking-[0.12em]">{term}</dt>
      <dd className="font-display flex items-center gap-2 text-[34px] leading-none font-extrabold">
        {children}
      </dd>
    </div>
  )
}

/**
 * The featured game: its cover, genre, name, squad size, open Squads and most used tags, and a link
 * to its Squads on the board. Below 640px the cover becomes a band above the details.
 */
export function FeaturedGame({ games, featured }: FeaturedGameProps) {
  const t = useTranslations('landing.games')
  const headingId = useId()
  const { game, openSquadCount, topTags } = featured
  const genre = game.genres[0]?.name

  return (
    <article
      aria-labelledby={headingId}
      className="bg-card flex h-full min-w-0 flex-col sm:flex-row"
    >
      <div className="bg-raised-2 relative aspect-video w-full shrink-0 overflow-hidden sm:aspect-3/4 sm:w-62.5">
        {games.map((entry) => (
          <img
            key={entry.game.id}
            src={entry.game.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              'absolute inset-0 size-full object-cover transition-opacity duration-200 ease-out',
              entry.game.id === game.id ? 'opacity-100' : 'opacity-0'
            )}
          />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5.5 p-6 sm:px-7.5 sm:pt-7.5 sm:pb-7">
        <div className="flex flex-col gap-2">
          {genre && (
            <span className="font-ds-mono text-text-3 text-xs font-bold tracking-[0.14em] uppercase">
              {genre}
            </span>
          )}
          <h3
            id={headingId}
            className="font-display text-[clamp(40px,4.4vw,56px)] leading-[1.02] font-black break-words uppercase"
          >
            {game.name}
          </h3>
        </div>
        <dl className="grid grid-cols-2 gap-0.5">
          <Stat term={t('squadSize')}>{gameRange(game)}</Stat>
          <Stat term={t('openNow')}>
            <span
              aria-hidden="true"
              className="bg-mint size-2 rounded-full motion-safe:animate-[pulse_1.6s_ease-in-out_infinite]"
            />
            {openSquadCount}
          </Stat>
        </dl>
        {topTags.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <span className="type-label text-ds-muted tracking-[0.12em]">{t('topTags')}</span>
            <ul className="flex flex-wrap gap-1.5">
              {topTags.map((tag) => (
                <li key={tag}>
                  <Tag label={tag} size="md" />
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="grow" />
        <AppLink
          href={gameSquadsHref(game)}
          className="text-mint hover-fine:text-mint-hover focus-visible:outline-mint inline-flex min-h-11 items-center gap-2 self-start text-sm font-extrabold no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {t('seeSquads', { name: game.name })}
          <ArrowRight aria-hidden="true" className="size-3.75" strokeWidth={2.6} />
        </AppLink>
      </div>
    </article>
  )
}
