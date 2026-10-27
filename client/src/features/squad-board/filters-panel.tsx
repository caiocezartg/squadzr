import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Segmented } from '@/components/ds/segmented'
import { querySquadList, rankTagOptions, type UseSquadFiltersReturn } from '@/features/squad-list'
import { AvailabilityOptions } from './availability-options'
import { TagFilter } from './tag-filter'
import { useSquadBoardSquads } from './use-squad-board-data'

interface FiltersPanelProps {
  readonly filters: UseSquadFiltersReturn
  /** The list's update count when the board mounted (see `useSquadBoardBaseline`). */
  readonly baseline: number
  /** Closes the panel: the main button does it once the viewer has seen the result. */
  readonly onClose: () => void
}

/**
 * The inside of the filters panel. It reads the board's list, so the tag options and the "Show N
 * squads" count follow the realtime updates; the tag options come from the whole list, so they stay
 * put as the filters narrow it. Every change applies at once.
 */
export function FiltersPanel({ filters, baseline, onClose }: FiltersPanelProps) {
  const t = useTranslations('ds.board')
  const squads = useSquadBoardSquads(baseline)
  const resultCount = querySquadList(squads, filters.query).matching.length

  return (
    <div className="flex flex-col gap-5.5">
      <div className="flex items-center justify-between gap-3 max-sm:pr-12">
        <span aria-hidden="true" className="type-panel-title-sm text-text">
          {t('panelTitle')}
        </span>
        <Button variant="ghost" size="sm" onClick={filters.clearFilters}>
          {t('clearAll')}
        </Button>
      </div>

      <AvailabilityOptions value={filters.filter} onChange={filters.setFilter} />

      <fieldset className="m-0 border-0 p-0">
        <legend className="type-label text-ds-muted mb-2.5 p-0">{t('language')}</legend>
        <Segmented
          label={t('language')}
          fluid
          value={filters.language}
          onChange={filters.setLanguage}
          options={[
            { value: 'all', label: t('languageAll') },
            { value: 'pt-br', label: 'PT-BR' },
            { value: 'en', label: 'EN-US' },
          ]}
        />
      </fieldset>

      <TagFilter
        options={rankTagOptions(squads, filters.tags)}
        selected={filters.tags}
        onToggle={filters.toggleTag}
      />

      <fieldset className="m-0 border-0 p-0">
        <legend className="type-label text-ds-muted mb-2.5 p-0">{t('sort')}</legend>
        <Segmented
          label={t('sort')}
          fluid
          value={filters.sort}
          onChange={filters.setSort}
          options={[
            { value: 'newest', label: t('sortNewest') },
            { value: 'oldest', label: t('sortOldest') },
          ]}
        />
      </fieldset>

      <Button size="lg" full onClick={onClose}>
        {t('show', { count: resultCount })}
      </Button>
    </div>
  )
}
