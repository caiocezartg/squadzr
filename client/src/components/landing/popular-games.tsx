'use client'

import * as m from 'motion/react-m'
import type { PopularGame } from '@/types'
import { useTranslations } from 'next-intl'

interface PopularGamesProps {
  /** The games the server ranked: open Squads first, then the Featured Games on a quiet day. */
  readonly games: readonly PopularGame[]
}

export function PopularGames({ games }: PopularGamesProps) {
  const t = useTranslations()

  return (
    <section className="relative py-24 border-t border-border/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <m.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <span className="section-label">{t('popularGames.label')}</span>
          <h2 className="font-heading text-3xl font-bold sm:text-4xl">{t('popularGames.title')}</h2>
          <p className="mt-4 text-muted max-w-lg mx-auto">{t('popularGames.subtitle')}</p>
        </m.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {games.map(({ game, openSquadCount, topTags }, i) => (
            <m.div
              key={game.id}
              className="relative aspect-3/4 rounded-xl overflow-hidden border border-border bg-surface cursor-default"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <img
                src={game.coverUrl}
                alt={game.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
                loading="lazy"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />

              {/* Game info */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className="text-xs font-semibold text-accent">
                  {t('popularGames.openSquads', { count: openSquadCount })}
                </p>
                <h3 className="font-heading text-sm font-bold truncate">{game.name}</h3>
                <p className="text-xs text-muted mt-0.5">
                  {t('popularGames.playerRange', { min: game.minPlayers, max: game.maxPlayers })}
                </p>
                {topTags.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {topTags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-muted"
                      >
                        #{tag}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Hover glow */}
              <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5 group-hover:ring-accent/30 transition-all duration-300" />
            </m.div>
          ))}
        </div>

        <m.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.5 }}
        >
          <p className="mt-8 text-muted text-lg max-w-lg mx-auto">{t('popularGames.moreGames')}</p>
        </m.div>
      </div>
    </section>
  )
}
