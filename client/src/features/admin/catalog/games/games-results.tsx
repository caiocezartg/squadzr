'use client'

import { useTranslations } from 'next-intl'
import { PAGE_SIZE, type AdminGamesResponse } from '@squadzr/schemas'
import { Pagination } from '@/components/ds/pagination'
import { GamesRowList } from './games-row-list'
import { GamesEmpty } from './games-states'
import { GamesTable } from './games-table'

interface GamesResultsProps {
  readonly data: AdminGamesResponse
  /** A search or a status is set, so an empty answer is a no-match. */
  readonly filtered: boolean
  /** The page the URL asks for, which `data` may still be the previous one of. */
  readonly page: number
  /** True while `data` is the previous filters' or page's, so it cannot speak for the new one. */
  readonly stale: boolean
  readonly onPageChange: (page: number) => void
  readonly onClearFilters: () => void
}

/** One page of games, as a table from 640px up and as cards below, with the pages under it. */
export function GamesResults({
  data,
  filtered,
  page,
  stale,
  onPageChange,
  onClearFilters,
}: GamesResultsProps) {
  const t = useTranslations('admin.catalog.games')
  const pageCount = Math.ceil(data.total / PAGE_SIZE)

  // An empty answer belongs to the filters and page it was read for: until the new one lands, say nothing.
  if (stale && data.items.length === 0) return null

  if (data.total === 0 && filtered) {
    return (
      <GamesEmpty
        title={t('noMatch.title')}
        description={t('noMatch.description')}
        action={{ label: t('noMatch.action'), onClick: onClearFilters }}
      />
    )
  }

  if (data.total === 0) {
    return <GamesEmpty title={t('empty.title')} description={t('empty.description')} />
  }

  // A page past the end answers no games with the real total: it offers the first page instead.
  if (data.items.length === 0) {
    return (
      <GamesEmpty
        title={t('pastEnd.title')}
        action={{ label: t('pastEnd.action'), onClick: () => onPageChange(1) }}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Both layouts are in the HTML, so the server render fits every width; CSS shows one. */}
      <div className="hidden sm:block">
        <GamesTable games={data.items} />
      </div>
      <div className="sm:hidden">
        <GamesRowList games={data.items} />
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
