import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface RoomFiltersProps {
  search: string
  onSearchChange: (value: string) => void
  filter: string
  onFilterChange: (value: string) => void
  sort: string
  onSortChange: (value: string) => void
  language: string
  onLanguageChange: (value: string) => void
  tagFilter: string
  onTagFilterChange: (value: string) => void
}

export function RoomFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  language,
  onLanguageChange,
  tagFilter,
  onTagFilterChange,
}: RoomFiltersProps) {
  const { t } = useTranslation()

  const filters = [
    { value: 'all', label: t('rooms.filters.statusAll') },
    { value: 'has-space', label: t('rooms.filters.statusHasSpace') },
    { value: 'almost-full', label: t('rooms.filters.statusAlmostFull') },
  ]

  const sorts = [
    { value: 'newest', label: t('rooms.filters.sortNewest') },
    { value: 'oldest', label: t('rooms.filters.sortOldest') },
  ]

  const languages = [
    { value: 'all', label: t('rooms.filters.langAll') },
    { value: 'pt-br', label: t('rooms.filters.langPtBr') },
    { value: 'en', label: t('rooms.filters.langEn') },
  ]

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Row 1: Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('rooms.filters.searchPlaceholder')}
            className="input-field pl-10"
          />
        </div>

        <div className="relative flex-1 sm:flex-none">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">#</span>
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
            placeholder={t('rooms.filters.tagPlaceholder')}
            className="input-field pl-7"
          />
        </div>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="input-field w-auto min-w-[120px]"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Row 2: Status filter chips + Language filter chips */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => onFilterChange(f.value)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                filter === f.value
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-surface text-muted border border-border hover:border-border-light hover:text-offwhite'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <span className="hidden sm:block text-border-light">|</span>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted/60">
            {t('rooms.filters.lang')}
          </span>
          {languages.map((l) => (
            <button
              key={l.value}
              onClick={() => onLanguageChange(l.value)}
              className={`shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                language === l.value
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-surface text-muted border border-border hover:border-border-light hover:text-offwhite'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
