'use client'

import { useState } from 'react'
import { ArrowDownUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AdminSquadSort } from '@squadzr/schemas'
import { Popover } from '@/components/ds/popover'
import { FilterChip } from './filter-chip'
import { SortOptions, useSortLabel } from './sort-options'

interface SortFilterProps {
  readonly sort: AdminSquadSort
  readonly onChange: (sort: AdminSquadSort) => void
}

/**
 * The toolbar's "Sort: …" chip and the panel it opens (a bottom sheet below 640px) to order the list.
 * The chip names the kept sort, in mint when it is not the default (newest first).
 */
export function SortFilter({ sort, onChange }: SortFilterProps) {
  const t = useTranslations('admin.squads.sort')
  const label = useSortLabel()
  const [open, setOpen] = useState(false)

  const pick = (next: AdminSquadSort) => {
    setOpen(false)
    onChange(next)
  }

  return (
    <Popover
      title={t('title')}
      hideTitle
      bottomSheet
      align="end"
      open={open}
      onOpenChange={setOpen}
      className="p-4 sm:w-72 sm:max-w-[calc(100vw-2rem)]"
      trigger={
        <FilterChip
          open={open}
          active={sort !== 'newest'}
          label={t('chip', { sort: label(sort) })}
          leading={<ArrowDownUp aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />}
        />
      }
    >
      <SortOptions sort={sort} onPick={pick} />
    </Popover>
  )
}
