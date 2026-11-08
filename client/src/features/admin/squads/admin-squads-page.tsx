'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ADMIN_SQUAD_SEARCH_MAX_LENGTH, type AdminSquadDto } from '@squadzr/schemas'
import { SearchField } from '@/components/ds/search-field'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '../shell/admin-page-header'
import { GameFilter } from './game-filter'
import { SquadPanel } from './squad-panel'
import { SquadsResults } from './squads-results'
import { SquadsLoadError, SquadsSkeleton } from './squads-states'
import { useAdminSquads } from './squads-query'
import { useSelectedSquad } from './use-selected-squad'
import { useSquadsSearch } from './use-squads-search'

/**
 * The Squads page: every Open Squad, searchable by name, code or host and filtered by Game, 20 per
 * page, the filters and page held in the URL as `?q=&gameId=&page=`. A row opens the Squad's side panel
 * (`?squad=`), where it can be closed with a reason. Results the server or an earlier visit read render
 * at once; the skeleton is only for filters and a page the cache never held, and a new search or page
 * keeps the previous results on screen until its own land.
 */
export function AdminSquadsPage() {
  const t = useTranslations('admin.squads')
  const filters = useSquadsSearch()
  const selection = useSelectedSquad()
  const query = useAdminSquads(filters.search, filters.gameId, filters.page)
  const opener = useRef<HTMLElement | null>(null)
  const [closedName, setClosedName] = useState<string | null>(null)
  const items = query.data?.items
  const row = items?.find((squad) => squad.id === selection.squadId) ?? null
  const firstGame = items?.[0]?.game
  const knownGameName = firstGame && firstGame.id === filters.gameId ? firstGame.name : null

  const open = (squad: AdminSquadDto, element: HTMLElement) => {
    opener.current = element
    setClosedName(null)
    selection.open(squad.id)
  }

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={
          query.data
            ? t(filters.search || filters.gameId ? 'countFiltered' : 'count', {
                count: query.data.total,
              })
            : t('description')
        }
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField
          label={t('search.label')}
          placeholder={t('search.placeholder')}
          value={filters.draft}
          onChange={filters.setDraft}
          onClear={filters.clearSearch}
          maxLength={ADMIN_SQUAD_SEARCH_MAX_LENGTH}
          className="sm:max-w-md"
        />
        <GameFilter gameId={filters.gameId} knownName={knownGameName} onChange={filters.setGame} />
      </div>
      <p role="status" className="text-mint text-[12.5px] font-semibold empty:hidden">
        {closedName && t('closed', { name: closedName })}
      </p>
      {query.data ? (
        <div
          aria-busy={query.isPlaceholderData}
          className={cn(query.isPlaceholderData && 'opacity-70')}
        >
          <SquadsResults
            data={query.data}
            filtered={filters.search !== '' || filters.gameId !== ''}
            page={filters.page}
            stale={query.isPlaceholderData}
            selectedId={selection.squadId}
            onOpen={open}
            onPageChange={filters.goTo}
            onClearFilters={filters.clearFilters}
          />
        </div>
      ) : query.isError ? (
        <SquadsLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
      ) : (
        <SquadsSkeleton />
      )}
      <SquadPanel
        squadId={selection.squadId}
        row={row}
        returnFocus={opener}
        onClose={selection.close}
        onSquadClosed={(name) => {
          setClosedName(name)
          selection.close()
        }}
      />
    </>
  )
}
