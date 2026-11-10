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

const HEADER_CELL =
  'type-label text-faint px-2.5 pb-2.5 text-left align-bottom whitespace-nowrap xl:px-3'
// Below xl the long count labels may take two lines, so the counts fit beside the run at laptop widths.
const NUMBER_HEADER_CELL =
  'type-label text-faint px-2.5 pb-2.5 text-right align-bottom xl:px-3 xl:whitespace-nowrap'
const CELL = 'px-2.5 py-3 align-middle xl:px-3 shadow-[inset_0_1px_0_#16171b]'
const NUMBER_CELL = `${CELL} text-right`

/** Opens a run's detail; the element is where focus returns when it closes. */
export type OpenRun = (run: CatalogImportRunDto, opener: HTMLElement) => void

export interface RunsListProps {
  readonly runs: readonly CatalogImportRunDto[]
  /** The run whose detail is open, marked in the list. */
  readonly selectedId: string | null
  readonly onOpen: OpenRun
}

/**
 * The run history as a table, from 640px up (reference, Admin panel, Catalog Import): start, origin,
 * status, duration, and what the run changed, newest first. The start is the row's button, and it
 * covers the whole row, so a click anywhere opens the run's detail.
 */
export function RunsTable({ runs, selectedId, onOpen }: RunsListProps) {
  const t = useTranslations('admin.catalog')

  return (
    <table className="w-full border-collapse text-[13.5px] font-medium">
      <caption className="sr-only">{t('tableLabel')}</caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.started')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.origin')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.status')}
          </th>
          <th scope="col" className={`${HEADER_CELL} max-xl:hidden`}>
            {t('columns.duration')}
          </th>
          <th scope="col" className={NUMBER_HEADER_CELL}>
            {t('columns.created')}
          </th>
          <th scope="col" className={NUMBER_HEADER_CELL}>
            {t('columns.delisted')}
          </th>
          <th scope="col" className={`${NUMBER_HEADER_CELL} max-xl:hidden`}>
            {t('columns.relisted')}
          </th>
          <th scope="col" className={NUMBER_HEADER_CELL}>
            {t('columns.listedGames')}
          </th>
        </tr>
      </thead>
      <tbody className="text-text-2">
        {runs.map((run) => (
          <RunsTableRow key={run.id} run={run} selected={run.id === selectedId} onOpen={onOpen} />
        ))}
      </tbody>
    </table>
  )
}

interface RunsTableRowProps {
  readonly run: CatalogImportRunDto
  readonly selected: boolean
  readonly onOpen: OpenRun
}

function RunsTableRow({ run, selected, onOpen }: RunsTableRowProps) {
  return (
    <tr className={cn('hover-fine:bg-raised relative h-11', selected && 'bg-raised')}>
      <td className={CELL}>
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(event) => onOpen(run, event.currentTarget)}
          className="text-text focus-visible:outline-mint text-left font-bold after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <RunInstant at={runStartOf(run)} />
        </button>
      </td>
      <td className={`${CELL} whitespace-nowrap`}>
        <RunOrigin run={run} />
      </td>
      <td className={CELL}>
        <RunStatusPill status={run.status} />
      </td>
      <td className={`${CELL} text-muted max-xl:hidden`}>
        <RunDurationView run={run} />
      </td>
      <td className={NUMBER_CELL}>
        <RunCount value={run.summary?.created} />
      </td>
      <td className={NUMBER_CELL}>
        <RunCount value={run.summary?.delisted} />
      </td>
      <td className={`${NUMBER_CELL} max-xl:hidden`}>
        <RunCount value={run.summary?.relisted} />
      </td>
      <td className={NUMBER_CELL}>
        <RunCount value={run.listedGames} />
      </td>
    </tr>
  )
}
