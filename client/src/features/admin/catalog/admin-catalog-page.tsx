'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  PAGE_SIZE,
  type CatalogImportRunDto,
  type CatalogImportRunsResponse,
} from '@squadzr/schemas'
import { Pagination } from '@/components/ds/pagination'
// The page parameter works the same on every paginated admin list.
import { useAuditPage as useCatalogPage } from '../audit/use-audit-page'
import { CatalogHeader } from './catalog-header'
import { useCatalogImportRuns } from './catalog-query'
import { CatalogEmpty, CatalogLoadError, CatalogSkeleton } from './catalog-states'
import { RunPanel } from './run-panel'
import { RunsRowList } from './runs-row-list'
import { RunsTable, type OpenRun } from './runs-table'

/**
 * The admin Catalog page's Import runs tab (`/admin/catalog/runs`): the Catalog Import Run history, newest first, 20 per page, the page held in
 * the URL as `?page=`. A page the server or an earlier visit read renders at once, with no skeleton;
 * the skeleton is only for a page the cache has never held. Moving between pages keeps the previous
 * page on screen until the next one lands. A row opens the run's detail in a side panel.
 */
export function AdminCatalogPage() {
  const [page, goTo] = useCatalogPage()
  const query = useCatalogImportRuns(page)

  return (
    <>
      <CatalogHeader current="runs" />
      {query.data ? (
        <CatalogResults data={query.data} page={page} onPageChange={goTo} />
      ) : query.isError ? (
        <CatalogLoadError onRetry={() => void query.refetch()} />
      ) : (
        <CatalogSkeleton />
      )}
    </>
  )
}

interface CatalogResultsProps {
  readonly data: CatalogImportRunsResponse
  /** The page the URL asks for, which `data` may still be the previous one of. */
  readonly page: number
  readonly onPageChange: (page: number) => void
}

function CatalogResults({ data, page, onPageChange }: CatalogResultsProps) {
  const t = useTranslations('admin.catalog')
  const pageCount = Math.ceil(data.total / PAGE_SIZE)
  const detail = useRunDetail()

  if (data.total === 0) {
    return <CatalogEmpty title={t('empty.title')} description={t('empty.description')} />
  }

  // A page past the end answers no runs with the real total: it offers the first page instead of a
  // pagination that has no place for it.
  if (data.items.length === 0) {
    return (
      <CatalogEmpty
        title={t('pastEnd.title')}
        action={{ label: t('pastEnd.action'), onClick: () => onPageChange(1) }}
      />
    )
  }

  const selectedId = detail.open ? (detail.run?.id ?? null) : null

  return (
    <div className="flex flex-col gap-3.5">
      {/* Both layouts are in the HTML, so the server render fits every width; CSS shows one. */}
      <div className="hidden sm:block">
        <RunsTable runs={data.items} selectedId={selectedId} onOpen={detail.show} />
      </div>
      <div className="sm:hidden">
        <RunsRowList runs={data.items} selectedId={selectedId} onOpen={detail.show} />
      </div>
      <Pagination
        page={page}
        pageCount={pageCount}
        onPageChange={onPageChange}
        className="flex-wrap justify-end"
      />
      <RunPanel
        run={detail.run}
        open={detail.open}
        returnFocus={detail.opener}
        onClose={detail.hide}
      />
    </div>
  )
}

/**
 * The run whose detail is open and the element that opened it, where focus returns. The run stays
 * after the panel closes, so its content holds while the panel slides out.
 */
function useRunDetail() {
  const opener = useRef<HTMLElement | null>(null)
  const [state, setState] = useState<{
    readonly run: CatalogImportRunDto | null
    readonly open: boolean
  }>({ run: null, open: false })

  const show: OpenRun = (run, element) => {
    opener.current = element
    setState({ run, open: true })
  }
  const hide = () => setState((current) => ({ ...current, open: false }))

  return { ...state, opener, show, hide }
}
