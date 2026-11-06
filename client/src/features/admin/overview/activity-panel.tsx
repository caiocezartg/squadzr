'use client'

import { useId, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ActivityMetric, OverviewPeriod } from '@squadzr/schemas'
import { ActivityTabs } from './activity-tabs'
import { ActivitySeries } from './activity-series'
import { ActivitySkeleton, OverviewLoadError } from './overview-states'
import { useActivity, useActivitySeriesOf } from './overview-query'
import { ViewSwitch, type ActivityView } from './view-switch'

/**
 * The Activity panel (reference, Admin panel, Overview): a metric per tab, its daily counts over the
 * period against the previous period, as a chart or as a table. A metric or period the cache holds
 * renders at once; moving to one it lacks keeps the previous series on screen, dimmed, until the new
 * one lands.
 */
export function ActivityPanel({ period }: { readonly period: OverviewPeriod }) {
  const t = useTranslations('admin.overview.activity')
  const [metric, setMetric] = useState<ActivityMetric>('completed')
  const [view, setView] = useState<ActivityView>('chart')
  const query = useActivity(metric, period)
  useActivitySeriesOf(period)
  const ids = useId()
  const titleId = `${ids}-title`
  const panelId = `${ids}-panel`
  const tabId = (tab: ActivityMetric) => `${ids}-tab-${tab}`

  return (
    <section
      aria-labelledby={titleId}
      className="bg-panel flex flex-col p-5 shadow-[inset_0_0_0_1px_var(--color-line)]"
    >
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label text-muted">{t('caption')}</p>
          <h2
            id={titleId}
            className="font-display mt-1.5 text-2xl leading-none font-black uppercase"
          >
            {t(`titles.${metric}`)}
          </h2>
        </div>
        <ActivityTabs value={metric} onChange={setMetric} tabId={tabId} panelId={panelId} />
      </div>
      <div id={panelId} role="tabpanel" aria-labelledby={tabId(metric)}>
        {query.data ? (
          <ActivitySeries
            data={query.data}
            view={view}
            caption={t(`titles.${metric}`)}
            busy={query.isPlaceholderData}
          />
        ) : query.isError ? (
          <OverviewLoadError message={t('loadError')} onRetry={() => void query.refetch()} />
        ) : (
          <ActivitySkeleton />
        )}
      </div>
      <div className="text-muted mt-3 flex items-center justify-between gap-3 text-[12.5px] font-medium">
        <p className="min-w-0">{t(`notes.${metric}`)}</p>
        <ViewSwitch value={view} onChange={setView} />
      </div>
    </section>
  )
}
