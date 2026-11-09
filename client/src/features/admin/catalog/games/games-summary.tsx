'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { AdminGamesSummaryDto } from '@squadzr/schemas'
import { StatTile } from '../../overview/stat-tile'
import { LastImportChanges } from './last-import-changes'
import { GamesLoadError } from './games-states'
import { useAdminGamesSummary } from './games-query'

/**
 * The Games tab's header strip: how many games are listed, delisted and featured, and what the last
 * import changed. A summary the cache holds renders at once; the placeholder is only for a cold load.
 */
export function GamesSummary() {
  const t = useTranslations('admin.catalog.games')
  const query = useAdminGamesSummary()

  if (query.data) return <GamesSummaryView summary={query.data} />
  if (query.isError) {
    return <GamesLoadError message={t('summaryLoadError')} onRetry={() => void query.refetch()} />
  }
  return (
    <div role="status" aria-label={t('summary.loading')} className="bg-card h-32 animate-pulse" />
  )
}

function GamesSummaryView({ summary }: { readonly summary: AdminGamesSummaryDto }) {
  const t = useTranslations('admin.catalog.games.summary')
  const format = useFormatter()

  return (
    <div className="grid gap-px lg:grid-cols-[3fr_2fr]">
      <dl
        aria-label={t('label')}
        className="bg-line grid grid-cols-3 gap-px p-px max-[480px]:grid-cols-1"
      >
        <StatTile label={t('listed')} value={format.number(summary.listed)}>
          {t('listedNote')}
        </StatTile>
        <StatTile label={t('delisted')} value={format.number(summary.delisted)}>
          {t('delistedNote')}
        </StatTile>
        <StatTile label={t('featured')} value={format.number(summary.featured)}>
          {t('featuredNote')}
        </StatTile>
      </dl>
      <LastImportChanges lastImport={summary.lastImport} />
    </div>
  )
}
