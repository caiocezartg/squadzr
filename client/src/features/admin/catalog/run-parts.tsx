'use client'

import { useFormatter, useTranslations } from 'next-intl'
import type { CatalogImportRunDto, CatalogImportRunStatus } from '@squadzr/schemas'
import { VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'
import { NoValue } from '../shared/no-value'
import { runDuration } from './run-duration'

/**
 * Each status's pill colours (reference, Admin panel, Catalog Import): succeeded in mint, running in
 * Discord blue, a safety stop in amber, a failure in red, and a queued or interrupted run muted.
 */
const STATUS_PILL: Record<CatalogImportRunStatus, string> = {
  requested: 'bg-raised-2 text-text-2',
  running: 'bg-discord-soft/13 text-discord-soft',
  succeeded: 'bg-mint/8 text-mint',
  safety_stop: 'bg-amber/10 text-amber',
  failed: 'bg-danger/10 text-danger',
  interrupted: 'bg-raised-2 text-text-2',
}

/** The run's status as a pill with a dot, its colours from `STATUS_PILL`. */
export function RunStatusPill({ status }: { readonly status: CatalogImportRunStatus }) {
  const t = useTranslations('admin.catalog.statuses')

  return (
    <span
      className={cn(
        'type-label inline-flex items-center gap-1.5 px-2 py-1 text-[10.5px] tracking-[0.12em] whitespace-nowrap',
        STATUS_PILL[status]
      )}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
      {t(status)}
    </span>
  )
}

/** Who started the run: "Scheduled" for the daily cron; for a manual run the admin's name, or "Manual" when it is unknown. */
export function RunOrigin({ run }: { readonly run: CatalogImportRunDto }) {
  const t = useTranslations('admin.catalog')

  if (run.trigger === 'scheduled') {
    return <span className="text-text-3">{t('scheduled')}</span>
  }
  if (run.requestedBy === null) {
    return <span className="text-text-3">{t('manual')}</span>
  }
  return <span className="text-text-2 break-words">{run.requestedBy.name}</span>
}

/** A moment of the run as its date and time in the viewer's zone, or a dash when it has not come. */
export function RunInstant({ at }: { readonly at: string | null }) {
  const label = useInstantLabel()

  if (at === null) return <NoValue />
  return (
    <time dateTime={at} className="whitespace-nowrap">
      {label(at)}
    </time>
  )
}

/** An ISO instant as its date and time in the viewer's locale and zone, as the run history writes it. */
export function useInstantLabel(): (at: string) => string {
  const format = useFormatter()

  return (at) =>
    format.dateTime(new Date(at), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: VIEWER_TIME_ZONE,
    })
}

/** When the run started, or when it was asked for while it waits in the queue. */
export function runStartOf(run: CatalogImportRunDto): string {
  return run.startedAt ?? run.requestedAt
}

/** How long the run took, as "3 min 12 s", or a dash while it has not finished. */
export function RunDurationView({ run }: { readonly run: CatalogImportRunDto }) {
  const label = useRunDurationLabel()(run)

  if (label === null) return <NoValue />
  return <span className="whitespace-nowrap">{label}</span>
}

/**
 * The run's duration as text, or `null` while it has not finished. An interrupted run has none: its
 * finish instant is when the next claim noticed it, not when it stopped.
 */
export function useRunDurationLabel(): (run: CatalogImportRunDto) => string | null {
  const t = useTranslations('admin.catalog.duration')

  return (run) => {
    const duration =
      run.status === 'interrupted' ? null : runDuration(run.startedAt, run.finishedAt)
    if (duration === null) return null
    if (duration.unit === 'seconds') return t('seconds', { seconds: duration.seconds })
    if (duration.unit === 'minutes') return t('minutes', duration)
    return t('hours', duration)
  }
}

/** A count of the run in tabular figures, or a dash when the run has none. */
export function RunCount({ value }: { readonly value: number | null | undefined }) {
  const format = useFormatter()

  if (value === null || value === undefined) return <NoValue />
  return <span className="tabular-nums">{format.number(value)}</span>
}
