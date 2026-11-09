'use client'

import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { CatalogHeader } from '../catalog-header'
import { GamesResults } from './games-results'
import { GamesLoadError, GamesSkeleton } from './games-states'
import { GamesSummary } from './games-summary'
import { GamesToolbar } from './games-toolbar'
import { useAdminGames } from './games-query'
import { useGamesSearch } from './use-games-search'

/**
 * The Catalog page's Games tab (`/admin/catalog`): the summary strip, then every game the catalog
 * holds, listed or not, searchable by name or alias, filtered by status and sorted, 20 per page, the
 * controls held in the URL as `?q=&status=&sort=&page=`. A row opens the game's page. Results the
 * server or an earlier visit read render at once; the skeleton is only for a list the cache never held,
 * and a new search or page keeps the previous results on screen until its own land.
 */
export function AdminGamesPage() {
  const t = useTranslations('admin.catalog.games')
  const filters = useGamesSearch()
  const query = useAdminGames(filters)

  return (
    <>
      <CatalogHeader current="games" />
      <GamesSummary />
      <GamesToolbar filters={filters} />
      {query.data ? (
        <div
          aria-busy={query.isPlaceholderData}
          className={cn(query.isPlaceholderData && 'opacity-70')}
        >
          <GamesResults
            data={query.data}
            filtered={filters.filtered}
            page={filters.page}
            stale={query.isPlaceholderData}
            onPageChange={filters.goTo}
            onClearFilters={filters.clearFilters}
          />
        </div>
      ) : query.isError ? (
        <GamesLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
      ) : (
        <GamesSkeleton label={t('loading')} />
      )}
    </>
  )
}
