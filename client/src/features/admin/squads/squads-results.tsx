'use client'

import { useTranslations } from 'next-intl'
import { PAGE_SIZE, type AdminSquadsResponse } from '@squadzr/schemas'
import { Pagination } from '@/components/ds/pagination'
import { SquadsRowList } from './squads-row-list'
import { SquadsEmpty } from './squads-states'
import { SquadsTable, type OpenSquad } from './squads-table'

interface SquadsResultsProps {
  readonly data: AdminSquadsResponse
  /** A search or a Game is set, so an empty answer is a no-match. */
  readonly filtered: boolean
  /** The page the URL asks for, which `data` may still be the previous one of. */
  readonly page: number
  /** True while `data` is the previous filters' or page's, so it cannot speak for the new one. */
  readonly stale: boolean
  readonly selectedId: string | null
  readonly onOpen: OpenSquad
  readonly onPageChange: (page: number) => void
  readonly onClearFilters: () => void
}

/** One page of Open Squads, as a table from 640px up and as cards below, with the pages under it. */
export function SquadsResults({
  data,
  filtered,
  page,
  stale,
  selectedId,
  onOpen,
  onPageChange,
  onClearFilters,
}: SquadsResultsProps) {
  const t = useTranslations('admin.squads')
  const pageCount = Math.ceil(data.total / PAGE_SIZE)

  // An empty answer belongs to the filters and page it was read for: until the new one lands, say nothing.
  if (stale && data.items.length === 0) return null

  if (data.total === 0 && filtered) {
    return (
      <SquadsEmpty
        title={t('noMatch.title')}
        description={t('noMatch.description')}
        action={{ label: t('noMatch.action'), onClick: onClearFilters }}
      />
    )
  }

  if (data.total === 0) {
    return <SquadsEmpty title={t('empty.title')} description={t('empty.description')} />
  }

  // A page past the end answers no Squads with the real total: it offers the first page instead.
  if (data.items.length === 0) {
    return (
      <SquadsEmpty
        title={t('pastEnd.title')}
        action={{ label: t('pastEnd.action'), onClick: () => onPageChange(1) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Both layouts are in the HTML, so the server render fits every width; CSS shows one. */}
      <div className="hidden sm:block">
        <SquadsTable squads={data.items} selectedId={selectedId} onOpen={onOpen} />
      </div>
      <div className="sm:hidden">
        <SquadsRowList squads={data.items} selectedId={selectedId} onOpen={onOpen} />
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
