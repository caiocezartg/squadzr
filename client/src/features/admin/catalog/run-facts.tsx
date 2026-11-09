'use client'

import { useId, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import type { CatalogImportRunDto } from '@squadzr/schemas'
import { RunCount, RunDurationView, RunInstant, RunOrigin, RunStatusPill } from './run-parts'

/** A labelled value of the run's detail, half the panel wide. */
function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="type-label text-muted">{label}</dt>
      <dd className="text-text text-sm font-semibold break-words">{children}</dd>
    </div>
  )
}

/** Where the run is and who started it: status, origin, the three instants and the duration. */
export function RunFacts({ run }: { readonly run: CatalogImportRunDto }) {
  const t = useTranslations('admin.catalog.panel')

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
      <Fact label={t('status')}>
        <RunStatusPill status={run.status} />
      </Fact>
      <Fact label={t('origin')}>
        <RunOrigin run={run} />
      </Fact>
      <Fact label={t('requestedAt')}>
        <RunInstant at={run.requestedAt} />
      </Fact>
      <Fact label={t('startedAt')}>
        <RunInstant at={run.startedAt} />
      </Fact>
      <Fact label={t('finishedAt')}>
        <RunInstant at={run.finishedAt} />
      </Fact>
      <Fact label={t('duration')}>
        <RunDurationView run={run} />
      </Fact>
    </dl>
  )
}

const SUMMARY_COUNTS = [
  'created',
  'updated',
  'delisted',
  'relisted',
  'received',
  'dropped',
  'invalid',
] as const

/**
 * What the run changed and read, each count with a dash when the run has none (only a succeeded run
 * has a summary), and the Listed Games count read after it.
 */
export function RunCounts({ run }: { readonly run: CatalogImportRunDto }) {
  const t = useTranslations('admin.catalog.panel')
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h3 id={titleId} className="type-label text-text-3">
        {t('counts')}
      </h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        {SUMMARY_COUNTS.map((key) => (
          <Fact key={key} label={t(`summary.${key}`)}>
            <span className="type-code text-text">
              <RunCount value={run.summary?.[key]} />
            </span>
          </Fact>
        ))}
        <Fact label={t('summary.listedGames')}>
          <span className="type-code text-text">
            <RunCount value={run.listedGames} />
          </span>
        </Fact>
      </dl>
    </section>
  )
}
