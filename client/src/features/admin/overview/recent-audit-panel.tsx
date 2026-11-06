'use client'

import { useId } from 'react'
import { useTranslations } from 'next-intl'
import type { AuditEntryDto } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import {
  AuditActorMark,
  AuditActorName,
  AuditTime,
  useAuditActionLabel,
} from '../audit/audit-entry-parts'

/** One recent action: who (as their avatar), what and on whom, and when. */
function RecentAuditRow({ entry }: { readonly entry: AuditEntryDto }) {
  const actionLabel = useAuditActionLabel()

  return (
    <li className="flex items-center gap-3 py-2.25 not-first:shadow-[inset_0_1px_0_#16171b]">
      <AuditActorMark entry={entry} size={28} />
      <p className="min-w-0 flex-1 text-[13px]">
        <span className="sr-only">
          <AuditActorName entry={entry} />:{' '}
        </span>
        <span className="text-text font-extrabold">{actionLabel(entry)}</span>
        {entry.target && <span className="text-text-3 font-medium"> · {entry.target.name}</span>}
      </p>
      <span className="text-muted shrink-0 text-xs font-medium">
        <AuditTime createdAt={entry.createdAt} />
      </span>
    </li>
  )
}

/**
 * The latest admin actions (reference, Admin panel, Overview), for the roles that may read the audit,
 * with a link to the whole Audit page.
 */
export function RecentAuditPanel({ entries }: { readonly entries: readonly AuditEntryDto[] }) {
  const t = useTranslations('admin.overview.recentAudit')
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
          href="/admin/audit"
          variant="ghost"
          size="sm"
          className="shadow-[inset_0_0_0_1px_var(--color-line)]"
        >
          {t('viewAll')}
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-text-3 text-[13.5px] font-medium">{t('empty')}</p>
      ) : (
        <ul aria-label={t('title')}>
          {entries.map((entry) => (
            <RecentAuditRow key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  )
}
