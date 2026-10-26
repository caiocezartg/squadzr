'use client'

import { Suspense, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'
import { useSession } from '@/hooks/use-session'
import { NotificationsBell } from '@/components/layout/notifications-bell'
import { AlertBox } from '@/components/ui/alert-box'
import { SquadFilters, useAppSquadSearch, useSquadFilters } from '@/features/squad-list'
import { MySquadsErrorBoundary } from './my-squads-error-boundary'
import { MySquadsResults } from './my-squads-results'
import { MySquadsSkeleton } from './skeleton'
import {
  useDiscardFailedMySquadsReads,
  useMySquadsBaseline,
  useSignedOutRedirect,
} from './use-my-squads-data'

/**
 * The My Squads page. It owns the public search and the create dialog's open state; the list reads
 * the data in its own component behind a Suspense boundary, so the title and the filters render
 * while the list loads. A request with no session cookie never reaches this page (the route
 * redirects it). When the API refuses the viewer's session, the page renders nothing and sends the
 * viewer to the landing.
 */
export function MySquadsView() {
  const t = useTranslations()
  const session = useSession()
  const [createOpen, setCreateOpen] = useState(false)
  const discardFailedReads = useDiscardFailedMySquadsReads()
  const baseline = useMySquadsBaseline()
  const signedOut = useSignedOutRedirect()
  // A new attempt remounts the list's error boundary, so it leaves the failure it showed.
  const [attempt, setAttempt] = useState(0)
  const retry = () => {
    discardFailedReads()
    setAttempt((current) => current + 1)
  }

  const search = useAppSquadSearch()
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
    hasActiveFilters,
    query,
  } = useSquadFilters(search)

  if (signedOut || !session?.user) {
    return null
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-heading text-2xl font-bold sm:text-3xl">{t('mySquads.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('mySquads.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCreateOpen(true)} className="btn-accent gap-2">
            <Plus className="size-4" />
            {t('common.createNewSquad')}
          </button>
          <NotificationsBell placement="page" />
        </div>
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

      <MySquadsErrorBoundary
        key={`results-${attempt}`}
        fallback={
          <div className="mb-6 mt-6 flex flex-col items-start gap-3">
            <AlertBox type="error" message={t('mySquads.loadError')} />
            <button onClick={retry} className="btn-ghost">
              {t('squads.page.retry')}
            </button>
          </div>
        }
      >
        <Suspense fallback={<MySquadsSkeleton />}>
          <MySquadsResults
            baseline={baseline}
            query={query}
            hasActiveFilters={hasActiveFilters}
            createOpen={createOpen}
            onCreateOpenChange={setCreateOpen}
          />
        </Suspense>
      </MySquadsErrorBoundary>
    </div>
  )
}
