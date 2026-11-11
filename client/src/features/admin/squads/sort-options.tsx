'use client'

import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ADMIN_SQUAD_SORTS, type AdminSquadSort } from '@squadzr/schemas'
import { cn } from '@/lib/utils'

/** Where each sort's label lives: the board's wording where it is the same, the admin's otherwise. */
const SORT_LABEL_KEYS = {
  newest: 'ds.board.sortNewest',
  oldest: 'ds.board.sortOldest',
  stale: 'admin.squads.sort.stale',
  fullest: 'admin.squads.sort.fullest',
} as const satisfies Record<AdminSquadSort, string>

/** The label of one sort, in the viewer's language. */
export function useSortLabel(): (sort: AdminSquadSort) => string {
  const t = useTranslations()
  return (sort) => t(SORT_LABEL_KEYS[sort])
}

interface SortOptionsProps {
  readonly sort: AdminSquadSort
  readonly onPick: (sort: AdminSquadSort) => void
}

/** The sort panel's content: one pressable row per sort, the kept one in mint with a check. */
export function SortOptions({ sort, onPick }: SortOptionsProps) {
  const t = useTranslations('ds.board')
  const label = useSortLabel()

  return (
    <div role="group" aria-label={t('sort')} className="flex flex-col gap-0.5">
      {ADMIN_SQUAD_SORTS.map((option) => {
        const selected = option === sort
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onPick(option)}
            className={cn(
              'press focus-visible:outline-mint hover-fine:bg-raised-2 flex min-h-11 items-center justify-between gap-3 px-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
              selected ? 'text-mint' : 'text-text-2 hover-fine:text-text'
            )}
          >
            <span className="min-w-0 break-words">{label(option)}</span>
            {selected && <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.6} />}
          </button>
        )
      })}
    </div>
  )
}
