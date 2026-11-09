'use client'

import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdminGameDetailDto } from '@squadzr/schemas'
import { NoValue } from '../../shared/no-value'
import { UserSectionHeading } from '../../users/user-section-heading'
import { RunInstant } from '../run-parts'
import { FeaturedRank, GameCount, GamePlatforms, GamePlayers } from './game-parts'

/** IGDB addresses a game's page by its slug. */
function igdbHref(slug: string): string {
  return `https://www.igdb.com/games/${encodeURIComponent(slug)}`
}

/** Every field the catalog holds for the game, read-only. */
export function GameFields({ game }: { readonly game: AdminGameDetailDto }) {
  const t = useTranslations('admin.catalog.games.detail.fields')

  return (
    <section aria-labelledby="admin-game-fields">
      <UserSectionHeading id="admin-game-fields" caption={t('caption')} title={t('title')} />
      <dl className="grid gap-x-6 gap-y-3.5 text-[13.5px] font-medium sm:grid-cols-[auto_1fr]">
        <Field label={t('aliases')}>
          <Chips values={game.aliases} />
        </Field>
        <Field label={t('genres')}>
          <Chips values={game.genres.map((genre) => genre.name)} />
        </Field>
        <Field label={t('platforms')}>
          <GamePlatforms platforms={game.platforms} />
        </Field>
        <Field label={t('players')}>
          <GamePlayers min={game.minPlayers} max={game.maxPlayers} />
        </Field>
        <Field label={t('popularity')}>
          <GameCount value={game.popularity} />
        </Field>
        <Field label={t('featuredRank')}>
          <FeaturedRank rank={game.featuredRank} />
        </Field>
        <Field label={t('slug')}>
          <span className="type-code break-all">{game.slug}</span>
        </Field>
        <Field label={t('igdb')}>
          {game.igdbId === null ? (
            <NoValue />
          ) : (
            <a
              href={igdbHref(game.slug)}
              target="_blank"
              rel="noreferrer"
              className="text-mint focus-visible:outline-mint inline-flex items-center gap-1.5 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className="type-code">{game.igdbId}</span>
              <ExternalLink aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
              <span className="sr-only">{t('igdbLink')}</span>
            </a>
          )}
        </Field>
        <Field label={t('createdAt')}>
          <RunInstant at={game.createdAt} />
        </Field>
        <Field label={t('updatedAt')}>
          <RunInstant at={game.updatedAt} />
        </Field>
      </dl>
    </section>
  )
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:contents">
      <dt className="type-label text-faint text-[10.5px] sm:pt-0.5">{label}</dt>
      <dd className="text-text-2 min-w-0">{children}</dd>
    </div>
  )
}

/** Short values as chips, or a dash when there are none. */
function Chips({ values }: { readonly values: readonly string[] }) {
  if (values.length === 0) return <NoValue />
  return (
    <ul className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <li key={value} className="bg-raised-2 text-text-2 px-2 py-0.5 text-xs font-semibold">
          {value}
        </li>
      ))}
    </ul>
  )
}
