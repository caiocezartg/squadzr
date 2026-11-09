'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { useGamesListHref } from './game-list-links'
import { GamesEmpty } from './games-states'

/** The page's loading state, only for a game nobody read before: the two panels' places. */
export function GamePageSkeleton() {
  const t = useTranslations('admin.catalog.games.detail')

  return (
    <div role="status" aria-label={t('loading')} className="grid gap-4.5 lg:grid-cols-[1.3fr_1fr]">
      <div aria-hidden="true" className="bg-card h-96 animate-pulse" />
      <div aria-hidden="true" className="bg-card h-96 animate-pulse" />
    </div>
  )
}

/** The game is not in the catalog: says so and leads back to the list. */
export function GameNotFound() {
  const t = useTranslations('admin.catalog.games.detail')
  const listHref = useGamesListHref()

  return (
    <div className="flex flex-col items-center gap-4">
      <GamesEmpty title={t('notFound.title')} description={t('notFound.description')} />
      <Button href={listHref} variant="secondary">
        {t('back')}
      </Button>
    </div>
  )
}
