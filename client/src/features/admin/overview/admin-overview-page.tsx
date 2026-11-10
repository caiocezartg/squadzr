'use client'

import { useTranslations } from 'next-intl'
import type { OverviewPeriod, OverviewResponse } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import { AdminPageHeader } from '../shell/admin-page-header'
import { ActivityPanel } from './activity-panel'
import { CatalogImportPanel } from './catalog-import-panel'
import { useOverview } from './overview-query'
import { OverviewStats } from './overview-stats'
import { OverviewLoadError, OverviewSkeleton } from './overview-states'
import { PeriodSwitch } from './period-switch'
import { RecentAuditPanel } from './recent-audit-panel'
import { useOverviewPeriod } from './use-overview-period'

/**
 * The admin Overview page: the live numbers with what the period brought, the Activity chart, the last
 * Catalog Import run and the latest admin actions, for the period the URL holds as `?period=`. A
 * period the server or an earlier visit read renders at once, with no skeleton; the skeleton is only
 * for a period the cache has never held. Moving to another period keeps the previous numbers on
 * screen, dimmed, until the new ones land.
 */
export function AdminOverviewPage() {
  const t = useTranslations('admin.overview')
  const [period, selectPeriod] = useOverviewPeriod()
  const query = useOverview(period)

  return (
    <>
      <AdminPageHeader
        title={t('title')}
        description={t('description')}
        actions={<PeriodSwitch value={period} onChange={selectPeriod} />}
      />
      {query.data ? (
        <OverviewContent overview={query.data} period={period} busy={query.isPlaceholderData} />
      ) : query.isError ? (
        <OverviewLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
      ) : (
        <OverviewSkeleton />
      )}
    </>
  )
}

interface OverviewContentProps {
  readonly overview: OverviewResponse
  /** The period the URL asks for, which `overview` may still be the previous one of. */
  readonly period: OverviewPeriod
  readonly busy: boolean
}

function OverviewContent({ overview, period, busy }: OverviewContentProps) {
  return (
    <div className="flex flex-col gap-4.5">
      <div aria-busy={busy} className={cn('motion-safe:transition-opacity', busy && 'opacity-60')}>
        <OverviewStats overview={overview} />
      </div>
      <ActivityPanel period={period} />
      {/* A moderator has neither panel; an admin has both, side by side from 1280px up, stacked below. */}
      {(overview.catalogImport || overview.recentAudit) && (
        <div className="grid items-start gap-4.5 xl:grid-cols-2">
          {overview.catalogImport && (
            <CatalogImportPanel lastRun={overview.catalogImport.lastRun} />
          )}
          {overview.recentAudit && <RecentAuditPanel entries={overview.recentAudit} />}
        </div>
      )}
    </div>
  )
}
