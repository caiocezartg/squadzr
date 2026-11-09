'use client'

import { useTranslations } from 'next-intl'
import { ADMIN_SQUAD_SEARCH_MAX_LENGTH } from '@squadzr/schemas'
import { Button } from '@/components/ds/button'
import { SearchField } from '@/components/ds/search-field'
import { GameFilter } from './game-filter'
import { PlatformLanguageFilter } from './platform-language-filter'
import { SortFilter } from './sort-filter'
import type { SquadsSearch } from './use-squads-search'

interface SquadsToolbarProps {
  readonly filters: SquadsSearch
  /** The kept Game's name when the page knows it, for the Game chip. */
  readonly knownGameName: string | null
}

/**
 * The list's controls: the search field, then the Game, platform and language, and sort chips, with
 * "Clear all" while a filter narrows the list. The chips sit beside the field from 640px and wrap
 * under it, full width, on phones; their panels are bottom sheets there.
 */
export function SquadsToolbar({ filters, knownGameName }: SquadsToolbarProps) {
  const t = useTranslations()

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <SearchField
        label={t('admin.squads.search.label')}
        placeholder={t('admin.squads.search.placeholder')}
        value={filters.draft}
        onChange={filters.setDraft}
        onClear={filters.clearSearch}
        maxLength={ADMIN_SQUAD_SEARCH_MAX_LENGTH}
        className="sm:max-w-md sm:min-w-64 sm:flex-1"
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <GameFilter gameId={filters.gameId} knownName={knownGameName} onChange={filters.setGame} />
        <PlatformLanguageFilter
          platform={filters.platform}
          language={filters.language}
          onPlatformChange={filters.setPlatform}
          onLanguageChange={filters.setLanguage}
        />
        <SortFilter sort={filters.sort} onChange={filters.setSort} />
        {filters.filtered && (
          <Button variant="link" onClick={filters.clearFilters}>
            {t('ds.board.clearAll')}
          </Button>
        )}
      </div>
    </div>
  )
}
