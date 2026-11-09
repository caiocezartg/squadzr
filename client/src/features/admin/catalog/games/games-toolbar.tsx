'use client'

import { ArrowDownUp, ListFilter } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  ADMIN_GAME_SEARCH_MAX_LENGTH,
  ADMIN_GAME_SORTS,
  ADMIN_GAME_STATUSES,
} from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { SearchField } from '@/components/ds/search-field'
import { DEFAULT_GAME_SORT, DEFAULT_GAME_STATUS } from '@/lib/admin-games-path'
import { ChoiceFilter } from './choice-filter'
import type { GamesSearch } from './use-games-search'

const CHIP_ICON = 'size-4 shrink-0'

/**
 * The Games list's controls: the search field, then the status and sort chips, with "Clear all" while
 * the search or the status narrows the list. The chips sit beside the field from 640px and wrap under
 * it on phones.
 */
export function GamesToolbar({ filters }: { readonly filters: GamesSearch }) {
  const t = useTranslations('admin.catalog.games')
  const tBoard = useTranslations('ds.board')
  const statusLabel = (status: (typeof ADMIN_GAME_STATUSES)[number]) => t(`status.${status}`)
  const sortLabel = (sort: (typeof ADMIN_GAME_SORTS)[number]) => t(`sort.${sort}`)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchField
        label={t('search.label')}
        placeholder={t('search.placeholder')}
        value={filters.draft}
        onChange={filters.setDraft}
        onClear={filters.clearSearch}
        maxLength={ADMIN_GAME_SEARCH_MAX_LENGTH}
        className="sm:max-w-md sm:min-w-64 sm:flex-1"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <ChoiceFilter
          title={t('status.title')}
          chip={t('status.chip', { status: statusLabel(filters.status) })}
          leading={<ListFilter aria-hidden="true" className={CHIP_ICON} strokeWidth={2.4} />}
          options={ADMIN_GAME_STATUSES}
          label={statusLabel}
          value={filters.status}
          defaultValue={DEFAULT_GAME_STATUS}
          onChange={filters.setStatus}
        />
        <ChoiceFilter
          title={t('sort.title')}
          chip={t('sort.chip', { sort: sortLabel(filters.sort) })}
          leading={<ArrowDownUp aria-hidden="true" className={CHIP_ICON} strokeWidth={2.4} />}
          options={ADMIN_GAME_SORTS}
          label={sortLabel}
          value={filters.sort}
          defaultValue={DEFAULT_GAME_SORT}
          onChange={filters.setSort}
        />
        {filters.filtered && (
          <Button variant="link" onClick={filters.clearFilters}>
            {tBoard('clearAll')}
          </Button>
        )}
      </div>
    </div>
  )
}
