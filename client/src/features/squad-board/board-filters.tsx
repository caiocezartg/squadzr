import { Suspense, useState, type ComponentProps } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Popover } from '@/components/ds/popover'
import { SearchField } from '@/components/ds/search-field'
import type { UseSquadFiltersReturn } from '@/features/squad-list'
import { cn } from '@/lib/utils'
import { BoardErrorBoundary } from './board-error-boundary'
import { FilterChips } from './filter-chips'
import { FiltersPanel } from './filters-panel'

interface BoardFiltersProps {
  readonly filters: UseSquadFiltersReturn
  /** The list's update count when the board mounted (see `useSquadBoardBaseline`). */
  readonly baseline: number
}

/**
 * The board's filter controls: one search bar with a "Filters" button, which opens the panel, and the
 * removable chips of the active filters under it. The bar and the chips come from the URL alone, so
 * they render while the list loads; the panel reads the list in its own boundary.
 */
export function BoardFilters({ filters, baseline }: BoardFiltersProps) {
  const t = useTranslations('ds.board')
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="bg-card relative z-5 flex items-center gap-1.5 p-1.5">
        <div className="min-w-0 flex-1">
          <SearchField
            variant="bare"
            label={t('searchLabel')}
            placeholder={t('searchPlaceholder')}
            value={filters.localSearch}
            onChange={filters.setLocalSearch}
          />
        </div>
        <span aria-hidden="true" className="bg-track mx-1.5 h-6.5 w-px shrink-0" />
        <Popover
          title={t('panelTitle')}
          hideTitle
          bottomSheet
          align="end"
          open={open}
          onOpenChange={setOpen}
          className="w-105 max-w-[calc(100vw-2rem)] p-5.5"
          trigger={<FiltersButton open={open} count={filters.activeFilterCount} />}
        >
          <BoardErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <FiltersPanel filters={filters} baseline={baseline} onClose={() => setOpen(false)} />
            </Suspense>
          </BoardErrorBoundary>
        </Popover>
      </div>
      <FilterChips filters={filters} />
    </>
  )
}

/** The popover hands its trigger behaviour to this element, so it spreads what it is given onto the button. */
function FiltersButton({
  open,
  count,
  ...triggerProps
}: ComponentProps<'button'> & {
  readonly open: boolean
  readonly count: number
}) {
  const t = useTranslations('ds.board')

  return (
    <button
      type="button"
      {...triggerProps}
      className={cn(
        'press focus-visible:outline-mint inline-flex min-h-11.5 shrink-0 items-center gap-2.25 px-4 font-body text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2',
        open ? 'bg-text text-bg' : 'bg-raised-2 text-text hover-fine:bg-track'
      )}
    >
      <SlidersHorizontal aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {t('filters')}
      {count > 0 && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'font-ds-mono px-1.5 py-0.5 text-[11px] font-extrabold',
              open ? 'bg-bg text-mint' : 'bg-mint text-mint-ink'
            )}
          >
            {count}
          </span>
          <span className="sr-only">{t('activeFilters', { count })}</span>
        </>
      )}
    </button>
  )
}
