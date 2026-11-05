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

const HEADER_CELL = 'type-label text-faint px-3 pb-2.5 text-left whitespace-nowrap'
const CELL = 'px-3 py-3 align-middle shadow-[inset_0_1px_0_#16171b]'

/**
 * The audit as a table, from 640px up (reference, Admin panel, Tables): when, who, action, target and
 * reason, newest first, with 44px rows and hairline dividers. Long names and reasons wrap inside their
 * column, so nothing scrolls sideways.
 */
export function AuditTable({ entries }: { readonly entries: readonly AuditEntryDto[] }) {
  const t = useTranslations('admin.audit')
  const actionLabel = useAuditActionLabel()
  const detail = useAuditDetail()

  return (
    <table className="w-full border-collapse text-[13.5px] font-medium">
      <caption className="sr-only">{t('tableLabel')}</caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.when')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.who')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.action')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.target')}
          </th>
          <th scope="col" className={HEADER_CELL}>
            {t('columns.reason')}
          </th>
        </tr>
      </thead>
      <tbody className="text-text-2">
        {entries.map((entry) => {
          const entryDetail = detail(entry)

          return (
            <tr key={entry.id} className="h-11">
              <td className={`${CELL} text-muted`}>
                <AuditTime createdAt={entry.createdAt} />
              </td>
              <td className={CELL}>
                <span className="flex items-center gap-2.5">
                  <AuditActorMark entry={entry} size={28} />
                  <AuditActorName entry={entry} />
                </span>
              </td>
              <td className={CELL}>
                <span className="flex flex-col">
                  <span className="text-text font-bold">{actionLabel(entry)}</span>
                  {entryDetail && (
                    <span className="text-muted text-xs">
                      <span className="sr-only">: </span>
                      {entryDetail}
                    </span>
                  )}
                </span>
              </td>
              <td className={CELL}>
                <AuditTargetView entry={entry} />
              </td>
              <td className={`${CELL} max-w-[32ch]`}>
                <AuditReasonView entry={entry} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
