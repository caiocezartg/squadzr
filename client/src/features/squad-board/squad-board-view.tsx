'use client'

import { Suspense, useState } from 'react'
import { useTranslations } from 'next-intl'
import { WS_URL } from '@/env'
import { useWebSocket } from '@/hooks/use-websocket'
import { useNotificationEvents } from '@/hooks/use-notification-events'
import { useAppSquadSearch, useSquadFilters } from '@/features/squad-list'
import { useSquadJoining } from '@/features/squad-joining'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { BoardErrorBoundary } from './board-error-boundary'
import { BoardFilters } from './board-filters'
import { BoardLoadError } from './board-load-error'
import { SquadBoardResults } from './squad-board-results'
import { SquadCount } from './squad-count'
import { SquadBoardSkeleton, SquadCountSkeleton } from './skeleton'
import { useDiscardFailedBoardReads, useSquadBoardBaseline } from './use-squad-board-data'
import { useSquadBoardEvents } from './use-squad-board-events'

/**
 * The Squad Board. It owns the public navigation state (filters, pagination and the shared `?join=`
 * link) and the realtime subscription. The open-squad count and the squad list read the board's data
 * in their own components, each behind a Suspense boundary, so the title and the search bar render
 * while the list loads, and a failed read shows its inline error in place of the list. Query keys,
 * event names and cache mutations stay inside the capability. The join workflow lives in its own
 * capability, and the shell owns the create dialog.
 */
export function SquadBoardView() {
  const t = useTranslations()
  const discardFailedReads = useDiscardFailedBoardReads()
  const baseline = useSquadBoardBaseline()
  // A new attempt remounts the board's error boundaries, so they leave the failure they showed.
  const [attempt, setAttempt] = useState(0)
  const retry = () => {
    discardFailedReads()
    setAttempt((current) => current + 1)
  }

  // WebSocket for real-time squad list updates
  const { on, subscribe } = useWebSocket(WS_URL)

  useSquadBoardEvents({ subscribe })
  useNotificationEvents({ on })

  const search = useAppSquadSearch()
  const joining = useSquadJoining(search)
  const filters = useSquadFilters(search)

  // The empty state names the search when its text or a filter narrows the list.
  const searchActive = Boolean(filters.localSearch || filters.activeFilterCount > 0)

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4.5 px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-7.5">
      <div className="relative z-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <h1 className="type-page-title max-sm:text-[44px]">{t('squads.page.title')}</h1>
          <BoardErrorBoundary key={`count-${attempt}`} fallback={null}>
            <Suspense fallback={<SquadCountSkeleton />}>
              <SquadCount baseline={baseline} />
            </Suspense>
          </BoardErrorBoundary>
        </div>
        {/* At 1024px and up the bell sits at the right of the title row; below, the top bar has it. */}
        <NotificationsBell placement="page" />
      </div>

      <BoardFilters filters={filters} baseline={baseline} />

      <BoardErrorBoundary key={`results-${attempt}`} fallback={<BoardLoadError onRetry={retry} />}>
        <Suspense fallback={<SquadBoardSkeleton />}>
          <SquadBoardResults
            baseline={baseline}
            query={filters.query}
            searchActive={searchActive}
            setPage={filters.setPage}
            joining={joining}
          />
        </Suspense>
      </BoardErrorBoundary>

      {joining.authPrompt}
    </div>
  )
}
