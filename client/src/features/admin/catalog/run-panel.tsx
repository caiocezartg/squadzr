'use client'

import type { RefObject } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { CatalogImportRunDto } from '@squadzr/schemas'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { SidePanel } from '../squads/side-panel'
import { RunCounts, RunFacts } from './run-facts'
import { RunNote } from './run-note'
import { runStartOf } from './run-parts'

interface RunPanelProps {
  /** The run whose detail shows; kept while the panel closes, so its content does not empty. */
  readonly run: CatalogImportRunDto | null
  readonly open: boolean
  readonly returnFocus: RefObject<HTMLElement | null>
  readonly onClose: () => void
}

/**
 * A run's detail in the side panel the Squads list uses: "Catalog Import" over the run's start, its
 * status, origin and instants, what went wrong or why it has not finished, and every count. The list
 * already holds the whole run, so nothing is read.
 */
export function RunPanel({ run, open, returnFocus, onClose }: RunPanelProps) {
  const t = useTranslations('admin.catalog.panel')
  const format = useFormatter()

  return (
    <SidePanel
      open={open && run !== null}
      onClose={onClose}
      caption={t('caption')}
      title={
        run
          ? t('title', {
              date: format.dateTime(new Date(runStartOf(run)), {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone: VIEWER_TIME_ZONE,
              }),
            })
          : t('caption')
      }
      returnFocus={returnFocus}
    >
      {run && (
        <>
          <RunFacts run={run} />
          <RunNote run={run} />
          <RunCounts run={run} />
        </>
      )}
    </SidePanel>
  )
}
