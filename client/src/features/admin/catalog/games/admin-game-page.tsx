'use client'

import { useTranslations } from 'next-intl'
import type { AdminGameDetailResponse } from '@squadzr/schemas'
import { ApiClientError } from '@/lib/api'
import { FeaturedBadge, GameCover, GameStatusBadge } from './game-parts'
import { GameFields } from './game-fields'
import { GameOpenSquads } from './game-open-squads'
import { GamePageHeader } from './game-page-header'
import { GameNotFound, GamePageSkeleton } from './game-page-states'
import { GameUsage } from './game-usage'
import { GamesLoadError } from './games-states'
import { useAdminGame } from './games-query'

const PANEL = 'bg-panel flex flex-col gap-5.5 p-5 shadow-[inset_0_0_0_1px_var(--color-line)]'

/**
 * One game's page in the Catalog: every field the catalog holds, how much the game is used and its
 * newest Open Squads, read-only. A game the server or an earlier visit read renders at once; the
 * skeleton is only for one the cache never held. A game the catalog does not hold says so.
 */
export function AdminGamePage({ id }: { readonly id: string }) {
  const t = useTranslations('admin.catalog.games.detail')
  const query = useAdminGame(id)

  if (query.data) return <GameDetail detail={query.data} />

  if (query.isError) {
    if (query.error instanceof ApiClientError && query.error.status === 404) {
      return (
        <>
          <GamePageHeader title={t('notFound.title')} />
          <GameNotFound />
        </>
      )
    }
    return (
      <>
        <GamePageHeader title={t('fallbackTitle')} />
        <GamesLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
      </>
    )
  }

  return (
    <>
      <GamePageHeader title={t('fallbackTitle')} />
      <GamePageSkeleton />
    </>
  )
}

function GameDetail({ detail }: { readonly detail: AdminGameDetailResponse }) {
  const { game, openSquads } = detail

  return (
    <>
      <GamePageHeader
        title={game.name}
        cover={<GameCover url={game.coverUrl} />}
        badges={
          <>
            <GameStatusBadge listed={game.listed} />
            {game.featuredRank !== null && <FeaturedBadge rank={game.featuredRank} />}
          </>
        }
      />
      <div className="grid items-start gap-4.5 lg:grid-cols-[1.3fr_1fr]">
        <div className={PANEL}>
          <GameFields game={game} />
        </div>
        <div className="flex flex-col gap-4.5">
          <GameUsage usage={game.usage} />
          <div className={PANEL}>
            <GameOpenSquads gameId={game.id} squads={openSquads} total={game.usage.openSquads} />
          </div>
        </div>
      </div>
    </>
  )
}
