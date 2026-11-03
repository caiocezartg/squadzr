import { useTranslations } from 'next-intl'
import { Button } from '@/components/ds/button'
import { Tag } from '@/components/ds/tag'
import { languageBadgeKey } from '@/lib/language-badge'
import type { UseSquadFiltersReturn } from '@/features/squad-list'
import { availabilityLabelKey } from './availability-options'

/** The active filters as removable chips, with a "Clear" link. The row keeps its height with no chips. */
export function FilterChips({ filters }: { readonly filters: UseSquadFiltersReturn }) {
  const t = useTranslations()
  const { filter, language, tags } = filters

  return (
    <div
      role="group"
      aria-label={t('ds.board.chipsLabel')}
      className="flex min-h-8.5 flex-wrap items-center gap-2"
    >
      {filter !== 'all' && (
        <Tag
          variant="removable"
          label={t(availabilityLabelKey(filter))}
          onClick={() => filters.setFilter('all')}
        />
      )}
      {language !== 'all' && (
        <Tag
          variant="removable"
          label={t(languageBadgeKey(language))}
          onClick={() => filters.setLanguage('all')}
        />
      )}
      {tags.map((tag) => (
        <Tag
          key={tag}
          variant="removable"
          label={`#${tag}`}
          onClick={() => filters.removeTag(tag)}
        />
      ))}
      {filters.activeFilterCount > 0 && (
        <Button variant="link" size="sm" onClick={filters.clearFilters}>
          {t('ds.board.clear')}
        </Button>
      )}
    </div>
  )
}
