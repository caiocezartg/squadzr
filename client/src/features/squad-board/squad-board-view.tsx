'use client'

import { Suspense, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import { WS_URL } from '@/env'
import { useWebSocket } from '@/hooks/use-websocket'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { SquadFilters, useAppSquadSearch, useSquadFilters } from '@/features/squad-list'
import { useSquadJoining } from '@/features/squad-joining'
import { AlertBox } from '@/components/ui/alert-box'
import { BoardErrorBoundary } from './board-error-boundary'
import { SquadBoardResults } from './squad-board-results'
import { SquadCount } from './squad-count'
import { SquadBoardSkeleton, SquadCountSkeleton } from './skeleton'
import { useDiscardFailedBoardReads, useSquadBoardBaseline } from './use-squad-board-data'
import { useSquadBoardEvents } from './use-squad-board-events'

/**
 * The Squad Board. It owns the public navigation state (filters, pagination and the shared `?join=`
 * link), the realtime subscription and the create dialog's open state. The squad count and the squad
 * list read the board's data in their own components, each behind a Suspense boundary, so the title and
 * the filters render while the list loads, and a failed read shows its inline error in place of the
 * list. Query keys, event names and cache mutations stay inside the capability. The create and join
 * workflows live in their own capabilities, behind this view.
 */
export function SquadBoardView() {
  const t = useTranslations()
  const session = useSession()
  const [createOpen, setCreateOpen] = useState(false)
  const discardFailedReads = useDiscardFailedBoardReads()
  const baseline = useSquadBoardBaseline()
  // A new attempt remounts the board's error boundaries, so they leave the failure they showed.
  const [attempt, setAttempt] = useState(0)
  const retry = () => {
    discardFailedReads()
    setAttempt((current) => current + 1)
  }

  // WebSocket for real-time squad list updates
  const { on, subscribe } = useWebSocket({
    url: WS_URL,
    autoConnect: true,
  })

  useSquadBoardEvents({ subscribe })
  useNotificationEvents({ on })

  const search = useAppSquadSearch()
  const joining = useSquadJoining(search)
  const {
    localSearch,
    setLocalSearch,
    localTag,
    setLocalTag,
    filter,
    setFilter,
    sort,
    setSort,
    language,
    setLanguage,
    setPage,
    query,
  } = useSquadFilters(search)

  // The empty state names the search when its text, language or tag narrows the list. The status
  // chips keep their own wording.
  const searchActive = Boolean(localSearch || language !== 'all' || localTag.trim())

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{t('squads.page.title')}</h1>
          <BoardErrorBoundary key={`count-${attempt}`} fallback={null}>
            <Suspense fallback={<SquadCountSkeleton />}>
              <SquadCount baseline={baseline} />
            </Suspense>
          </BoardErrorBoundary>
        </div>
        {session?.user && (
          <button
            onClick={() => setCreateOpen(true)}
            className="btn-accent gap-2 shrink-0 whitespace-nowrap"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t('common.createNewSquad')}</span>
            <span className="sm:hidden">{t('common.createSquad')}</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <SquadFilters
        search={localSearch}
        onSearchChange={setLocalSearch}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        language={language}
        onLanguageChange={setLanguage}
        tagFilter={localTag}
        onTagFilterChange={setLocalTag}
      />

      {/* Squad cards grid, pagination and the create dialog */}
      <BoardErrorBoundary
        key={`results-${attempt}`}
        fallback={
          <div className="mb-6 flex flex-col items-start gap-3">
            <AlertBox type="error" message={t('squads.page.loadError')} />
            <button onClick={retry} className="btn-ghost">
              {t('squads.page.retry')}
            </button>
          </div>
        }
      >
        <Suspense fallback={<SquadBoardSkeleton />}>
          <SquadBoardResults
            baseline={baseline}
            query={query}
            searchActive={searchActive}
            setPage={setPage}
            joining={joining}
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
          />
        </Suspense>
      </BoardErrorBoundary>

      {joining.authPrompt}
    </div>
  )
}
