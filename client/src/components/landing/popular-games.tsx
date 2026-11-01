'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Reveal } from '@/components/ui/reveal'
import type { PopularGame } from '@/types'
import { FeaturedGame } from './featured-game'
import { GameRow } from './game-row'
import { SectionEyebrow } from './section-eyebrow'

interface PopularGamesProps {
  /** The games the server ranked: open Squads first, then the Featured Games on a quiet day. */
  readonly games: readonly PopularGame[]
}

/**
 * The landing's games: a featured game next to the list of popular games, and the row the visitor
 * hovers, focuses or presses features its game. The first game is featured until then. Below 1024px
 * the featured game stacks above the list.
 */
export function PopularGames({ games }: PopularGamesProps) {
  const t = useTranslations('landing.games')
  const [featuredId, setFeaturedId] = useState<string | null>(null)
  const featured = games.find(({ game }) => game.id === featuredId) ?? games[0]

  return (
    <section id="jogos" className="bg-menu scroll-mt-20 px-4 pt-24 pb-30 sm:px-6">
      <div className="mx-auto flex max-w-310 flex-col gap-12">
        <Reveal stagger className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-160 flex-col gap-3.5">
            <SectionEyebrow>{t('label')}</SectionEyebrow>
            <h2 className="type-section-title text-balance">{t('title')}</h2>
          </div>
          <p className="text-text-3 max-w-95 text-base/[1.6]">{t('subtitle')}</p>
        </Reveal>

        {featured && (
          <Reveal stagger className="flex flex-col gap-7 lg:flex-row lg:items-stretch">
            <div className="min-w-0 lg:flex-[1_1_560px]">
              <FeaturedGame games={games} featured={featured} />
            </div>
            <div
              role="group"
              aria-label={t('listLabel')}
              className="flex min-w-0 flex-col gap-0.5 lg:flex-[1_1_420px]"
            >
              {games.map((entry) => (
                <GameRow
                  key={entry.game.id}
                  entry={entry}
                  featured={entry === featured}
                  onFeature={() => setFeaturedId(entry.game.id)}
                />
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}
