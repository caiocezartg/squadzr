'use client'

import { useTranslations } from 'next-intl'
import type { CatalogImportRunDto } from '@squadzr/schemas'
import { cn } from '@/lib/utils'
import {
  RunCount,
  RunDurationView,
  RunInstant,
  RunOrigin,
  RunStatusPill,
  runStartOf,
} from './run-parts'
import type { OpenRun, RunsListProps } from './runs-table'

/**
 * The run history below 640px: one card per run, each a button that opens its detail, with the
 * start and status first and the origin, duration and counts stacked under them. A count the run does
 * not have is left out here, where the table shows a dash. Nothing scrolls sideways.
 */
export function RunsRowList({ runs, selectedId, onOpen }: RunsListProps) {
  const t = useTranslations('admin.catalog')

  return (
    <ul aria-label={t('tableLabel')} className="flex flex-col gap-2">
      {runs.map((run) => (
        <li key={run.id}>
          <RunCard run={run} selected={run.id === selectedId} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  )
}

interface RunCardProps {
  readonly run: CatalogImportRunDto
  readonly selected: boolean
  readonly onOpen: OpenRun
}

function RunCard({ run, selected, onOpen }: RunCardProps) {
  const t = useTranslations('admin.catalog')
  const counts = [
    { key: 'created', value: run.summary?.created },
    { key: 'delisted', value: run.summary?.delisted },
    { key: 'relisted', value: run.summary?.relisted },
    { key: 'listedGames', value: run.listedGames ?? undefined },
  ] as const

  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={(event) => onOpen(run, event.currentTarget)}
      className={cn(
        'bg-panel press hover-fine:bg-raised focus-visible:outline-mint flex w-full flex-col gap-1.5 p-3.5 text-left text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)] focus-visible:outline-2 focus-visible:-outline-offset-2',
        selected && 'bg-raised'
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-text min-w-0 text-sm font-extrabold">
          <RunInstant at={runStartOf(run)} />
        </span>
        <RunStatusPill status={run.status} />
      </span>
      <span className="text-muted flex flex-wrap gap-x-2 text-xs">
        <RunOrigin run={run} />
        <span aria-hidden="true">·</span>
        <RunDurationView run={run} />
      </span>
      <span className="text-text-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {counts.map(
          ({ key, value }) =>
            value !== undefined && (
              <span key={key}>
                {t(`columns.${key}`)}{' '}
                <span className="text-text font-bold">
                  <RunCount value={value} />
                </span>
              </span>
            )
        )}
      </span>
    </button>
  )
}
