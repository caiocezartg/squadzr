'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminGameDto } from '@squadzr/schemas'
import { AppLink } from '@/components/layout/app-link'
import { SquadThumb } from '../../squads/squad-parts'
import { adminGameHref } from './game-links'
import { useGamesListQuery } from './game-list-links'
import { FeaturedRank, GameCount, GamePlatforms, GamePlayers, GameStatusBadge } from './game-parts'

/**
 * The games below 640px: one card per game, each a link to its page, with the table's fields stacked
 * under the name. Nothing scrolls sideways.
 */
export function GamesRowList({ games }: { readonly games: readonly AdminGameDto[] }) {
  const t = useTranslations('admin.catalog.games')
  const listQuery = useGamesListQuery()

  return (
    <ul aria-label={t('tableLabel')} className="flex flex-col gap-2">
      {games.map((game) => (
        <li key={game.id}>
          <GameCard game={game} listQuery={listQuery} />
        </li>
      ))}
    </ul>
  )
}

function GameCard({
  game,
  listQuery,
}: {
  readonly game: AdminGameDto
  readonly listQuery: string
}) {
  const t = useTranslations('admin.catalog.games.columns')

  return (
    <AppLink
      href={adminGameHref(game.id, listQuery)}
      className="bg-panel press hover-fine:bg-raised focus-visible:outline-mint flex w-full items-start gap-3 p-3.5 text-left text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-2 focus-visible:-outline-offset-2"
    >
      <SquadThumb url={game.coverThumbUrl} />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-start justify-between gap-3">
          <span className="text-text min-w-0 text-sm font-extrabold break-words">{game.name}</span>
          <GameStatusBadge listed={game.listed} />
        </span>
        <GamePlatforms platforms={game.platforms} />
        <span className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <CardFact label={t('players')}>
            <GamePlayers min={game.minPlayers} max={game.maxPlayers} />
          </CardFact>
          <CardFact label={t('popularity')}>
            <GameCount value={game.popularity} />
          </CardFact>
          <CardFact label={t('featured')}>
            <FeaturedRank rank={game.featuredRank} />
          </CardFact>
          <CardFact label={t('openSquads')}>
            <GameCount value={game.usage.openSquads} />
          </CardFact>
          <CardFact label={t('completedSquads')}>
            <GameCount value={game.usage.completedSquads} />
          </CardFact>
        </span>
      </span>
    </AppLink>
  )
}

function CardFact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      {label} <span className="text-text-2">{children}</span>
    </span>
  )
}
