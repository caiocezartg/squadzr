'use client'

import { useTranslations } from 'next-intl'
import { PAGE_SIZE, type AuditEntriesResponse } from '@squadzr/schemas'
import { Pagination } from '@/components/ds/pagination'
import { AdminPageHeader } from '../shell/admin-page-header'
import { useAuditEntries } from './audit-query'
import { AuditRowList } from './audit-row-list'
import { AuditEmpty, AuditLoadError, AuditSkeleton } from './audit-states'
import { AuditTable } from './audit-table'
import { useAuditPage } from './use-audit-page'

/**
 * The Audit page: every admin action, newest first, 20 per page, the page held in the URL as `?page=`.
 * A page the server or an earlier visit read renders at once, with no skeleton; the skeleton is only
 * for a page the cache has never held. Moving between pages keeps the previous page on screen until the
 * next one lands.
 */
export function AdminAuditPage() {
  const t = useTranslations('admin.audit')
  const [page, goTo] = useAuditPage()
  const query = useAuditEntries(page)

  return (
    <>
      <AdminPageHeader title={t('title')} description={t('description')} />
      {query.data ? (
        <AuditResults data={query.data} page={page} onPageChange={goTo} />
      ) : query.isError ? (
        <AuditLoadError onRetry={() => void query.refetch()} />
      ) : (
        <AuditSkeleton />
      )}
    </>
  )
}

interface AuditResultsProps {
  readonly data: AuditEntriesResponse
  /** The page the URL asks for, which `data` may still be the previous one of. */
  readonly page: number
  readonly onPageChange: (page: number) => void
}

function AuditResults({ data, page, onPageChange }: AuditResultsProps) {
  const t = useTranslations('admin.audit')
  const pageCount = Math.ceil(data.total / PAGE_SIZE)

  if (data.total === 0) {
    return <AuditEmpty title={t('empty.title')} description={t('empty.description')} />
  }

  // A page past the end answers no entries with the real total: it offers the first page instead of
  // a pagination that has no place for it.
  if (data.items.length === 0) {
    return (
      <AuditEmpty
        title={t('pastEnd.title')}
        action={{ label: t('pastEnd.action'), onClick: () => onPageChange(1) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Both layouts are in the HTML, so the server render fits every width; CSS shows one. */}
      <div className="hidden min-w-0 overflow-x-auto sm:block">
        <AuditTable entries={data.items} />
      </div>
      <div className="sm:hidden">
        <AuditRowList entries={data.items} />
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        className="flex-wrap justify-end"
      />
    </div>
  )
}
