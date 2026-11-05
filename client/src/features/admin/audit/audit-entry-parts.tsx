'use client'

import { Cog } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { AuditEntryDto } from '@squadzr/schemas'
import { Avatar, type AvatarSize } from '@/components/ds/avatar'
import { useTimeAgo, VIEWER_TIME_ZONE } from '@/hooks/use-time-ago'
import { cn } from '@/lib/utils'

/** A missing value: a dash on screen, a word for a screen reader. */
export function NoValue() {
  const t = useTranslations('admin.audit')

  return (
    <>
      <span aria-hidden="true" className="text-faint">
        —
      </span>
      <span className="sr-only">{t('none')}</span>
    </>
  )
}

/** When the entry was written: the relative time, with the full date and time as its tooltip. */
export function AuditTime({ createdAt }: { readonly createdAt: string }) {
  const format = useFormatter()
  const timeAgo = useTimeAgo(createdAt)
  const absolute = format.dateTime(new Date(createdAt), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: VIEWER_TIME_ZONE,
  })

  return (
    <time dateTime={createdAt} title={absolute} className="whitespace-nowrap">
      {timeAgo}
    </time>
  )
}

/** The avatar of whoever wrote the entry, or the System mark for an entry nobody wrote in the panel. */
export function AuditActorMark({
  entry,
  size,
}: {
  readonly entry: AuditEntryDto
  readonly size: Extract<AvatarSize, 28 | 34>
}) {
  if (entry.actorName === null) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'bg-raised-2 text-muted flex shrink-0 items-center justify-center rounded-full',
          size === 28 ? 'size-7' : 'size-8.5'
        )}
      >
        <Cog className={size === 28 ? 'size-3.5' : 'size-4'} strokeWidth={2.2} />
      </span>
    )
  }

  // An admin deleted since keeps their name, which then picks the colours.
  return <Avatar size={size} playerId={entry.actorId ?? entry.actorName} name={entry.actorName} />
}

/** Who wrote the entry: the admin's name, kept after their account is gone, or "System" in muted. */
export function AuditActorName({ entry }: { readonly entry: AuditEntryDto }) {
  const t = useTranslations('admin.audit')

  if (entry.actorName === null) return <span className="text-muted">{t('system')}</span>
  return <span className="text-text">{entry.actorName}</span>
}

/** The entry's action as a person reads it. */
export function useAuditActionLabel(): (entry: AuditEntryDto) => string {
  const t = useTranslations('admin.audit')
  return (entry) => t(`actions.${entry.action}`)
}

/**
 * What the action changed beyond its target, or `null`: the old and new role of a role change or a
 * grant, and "Manual run" for a Catalog Import an admin requested.
 */
export function useAuditDetail(): (entry: AuditEntryDto) => string | null {
  const t = useTranslations('admin.audit')

  return (entry) => {
    const { details } = entry
    if (details && 'oldRole' in details) {
      return t('roleChange', {
        from: t(`roles.${details.oldRole}`),
        to: t(`roles.${details.newRole}`),
      })
    }
    if (entry.action === 'catalog_import_requested') return t('manualRun')
    return null
  }
}

/**
 * What the action touched, from the entry's snapshot: a person's name, or a Squad's name with its code
 * and game. An entry without a target shows a dash.
 */
export function AuditTargetView({ entry }: { readonly entry: AuditEntryDto }) {
  const { target } = entry

  if (target === null) return <NoValue />
  if (target.type === 'user') return <span className="text-text-2">{target.name}</span>

  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-text-2 break-words">{target.name}</span>
      <span className="text-muted text-xs">
        <span className="type-code text-faint">#{target.code}</span> · {target.game}
      </span>
    </span>
  )
}

/** The reason an admin gave (Squad closures), quoted, or a dash. */
export function AuditReasonView({ entry }: { readonly entry: AuditEntryDto }) {
  const t = useTranslations('admin.audit')

  if (!entry.reason) return <NoValue />
  return <span className="text-text-3 break-words">{t('quoted', { text: entry.reason })}</span>
}
