'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminSquadDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '../shell/admin-page-header'
import { SquadPanel } from './squad-panel'
import { SquadsResults } from './squads-results'
import { SquadsLoadError, SquadsSkeleton } from './squads-states'
import { useAdminSquads } from './squads-query'
import { SquadsToolbar } from './squads-toolbar'
import { useFilteredGameName } from './use-game-name'
import { useSelectedSquad } from './use-selected-squad'
import { useSquadsSearch } from './use-squads-search'

/**
 * The Squads page: every Open Squad, searchable by name, code or host, filtered by Game, platform and
 * language and sorted, 20 per page, the filters and page held in the URL as
 * `?q=&gameId=&platform=&language=&sort=&page=`. A row opens the Squad's side panel
 * (`?squad=`), where it can be closed with a reason. Results the server or an earlier visit read render
 * at once; the skeleton is only for filters and a page the cache never held, and a new search or page
 * keeps the previous results on screen until its own land.
 */
export function AdminSquadsPage() {
  const t = useTranslations('admin.squads')
  const filters = useSquadsSearch()
  const selection = useSelectedSquad()
  const query = useAdminSquads(filters)
  const opener = useRef<HTMLElement | null>(null)
  const [closedName, setClosedName] = useState<string | null>(null)
  const items = query.data?.items
  const row = items?.find((squad) => squad.id === selection.squadId) ?? null
  const firstGame = items?.[0]?.game
  const rowGameName = firstGame && firstGame.id === filters.gameId ? firstGame.name : null
  const knownGameName = useFilteredGameName(filters.gameId, rowGameName)

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
            ? t(filters.filtered ? 'countFiltered' : 'count', {
                count: query.data.total,
              })
            : t('description')
        }
      />
      <SquadsToolbar filters={filters} knownGameName={knownGameName} />
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
            filtered={filters.filtered}
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
