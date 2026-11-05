'use client'

import { useTranslations } from 'next-intl'
import type { AuditEntryDto } from '@squadzr/schemas'
import {
  AuditActorMark,
  AuditActorName,
  AuditReasonView,
  AuditTargetView,
  AuditTime,
  useAuditActionLabel,
  useAuditDetail,
} from './audit-entry-parts'

/**
 * The audit below 640px (reference, Admin panel, Tables): one small card per entry with the table's
 * fields stacked, the action first and the time at its right. Nothing scrolls sideways. A missing
 * reason is left out here, where the table shows a dash.
 */
export function AuditRowList({ entries }: { readonly entries: readonly AuditEntryDto[] }) {
  const t = useTranslations('admin.audit')
  const actionLabel = useAuditActionLabel()
  const detail = useAuditDetail()

  return (
    <ul aria-label={t('tableLabel')} className="flex flex-col gap-2">
      {entries.map((entry) => {
        const entryDetail = detail(entry)

        return (
          <li
            key={entry.id}
            className="bg-panel flex items-start gap-3 p-3.5 text-[13px] font-medium shadow-[inset_0_0_0_1px_var(--color-line)]"
          >
            <AuditActorMark entry={entry} size={34} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-text min-w-0 text-sm font-extrabold">{actionLabel(entry)}</p>
                <span className="text-muted shrink-0 text-xs">
                  <AuditTime createdAt={entry.createdAt} />
                </span>
              </div>
              <p className="text-xs">
                <AuditActorName entry={entry} />
              </p>
              {entry.target !== null && (
                <div className="text-xs">
                  <AuditTargetView entry={entry} />
                </div>
              )}
              {entryDetail && <p className="text-muted text-xs">{entryDetail}</p>}
              {entry.reason && (
                <p className="text-xs">
                  <AuditReasonView entry={entry} />
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
