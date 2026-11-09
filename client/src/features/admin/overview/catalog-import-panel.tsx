'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import type { CatalogImportRunDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import {
  RunCount,
  RunInstant,
  RunOrigin,
  RunStatusPill,
  runStartOf,
  useRunDurationLabel,
} from '../catalog/run-parts'

/**
 * The last Catalog Import run (reference, Admin panel, Overview), for the roles that run the import:
 * its status, when it started, who started it and how long it took, then what it changed, or why it
 * changed nothing. A link leads to the whole history on the Catalog page.
 */
export function CatalogImportPanel({ lastRun }: { readonly lastRun: CatalogImportRunDto | null }) {
  const t = useTranslations('admin.overview.catalogImport')
  const titleId = useId()

  return (
    <section
      aria-labelledby={titleId}
      className="bg-panel p-5 shadow-[inset_0_0_0_1px_var(--color-line)]"
    >
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label text-muted">{t('caption')}</p>
          <h2
            id={titleId}
            className="font-display mt-1.5 text-2xl leading-none font-black uppercase"
          >
            {t('title')}
          </h2>
        </div>
        <Button
          href="/admin/catalog"
          variant="ghost"
          size="sm"
          className="shadow-[inset_0_0_0_1px_var(--color-line)]"
        >
          {t('viewAll')}
        </Button>
      </div>
      {lastRun === null ? (
        <p className="text-text-3 text-[13.5px] font-medium">{t('empty')}</p>
      ) : (
        <LastRun run={lastRun} />
      )}
    </section>
  )
}

function LastRun({ run }: { readonly run: CatalogImportRunDto }) {
  const duration = useRunDurationLabel()(run)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-text-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[13.5px] font-medium">
        <RunStatusPill status={run.status} />
        <RunInstant at={runStartOf(run)} />
        <span aria-hidden="true">·</span>
        <RunOrigin run={run} />
        {duration && (
          <>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">{duration}</span>
          </>
        )}
      </div>
      {run.summary ? <LastRunCounts run={run} /> : <LastRunNote run={run} />}
    </div>
  )
}

/** What a succeeded run changed, with the Listed Games count after it. */
function LastRunCounts({ run }: { readonly run: CatalogImportRunDto }) {
  const t = useTranslations('admin.catalog.columns')
  const counts = [
    { key: 'created', value: run.summary?.created },
    { key: 'delisted', value: run.summary?.delisted },
    { key: 'relisted', value: run.summary?.relisted },
    { key: 'listedGames', value: run.listedGames },
  ] as const

  return (
    <dl className="flex flex-wrap gap-x-6.5 gap-y-3">
      {counts.map(({ key, value }) => (
        <div key={key} className="flex flex-col-reverse gap-1.5">
          <dt className="type-label text-faint text-[10px]">{t(key)}</dt>
          <dd className="font-display text-[26px] leading-none font-extrabold">
            <RunCount value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Why the run changed nothing: the start of the error a safety stop or a failure wrote, or the note of
 * an interrupted, queued or running run. The Catalog page shows the whole message.
 */
function LastRunNote({ run }: { readonly run: CatalogImportRunDto }) {
  const t = useTranslations('admin.catalog.panel')

  if ((run.status === 'failed' || run.status === 'safety_stop') && run.errorMessage) {
    return (
      <p className="bg-raised text-text-2 line-clamp-2 p-3 font-mono text-[12.5px] break-words">
        {run.errorMessage}
      </p>
    )
  }
  if (run.status === 'interrupted') {
    return <p className="text-text-3 text-[13px] font-medium">{t('interrupted')}</p>
  }
  if (run.status === 'requested' || run.status === 'running') {
    return <p className="text-text-3 text-[13px] font-medium">{t('pending')}</p>
  }
  return null
}
