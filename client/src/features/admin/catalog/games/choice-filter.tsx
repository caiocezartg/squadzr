'use client'

import { useState, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Popover } from '@/components/ds/popover'
import { cn } from '@/lib/utils'
import { FilterChip } from '../../squads/filter-chip'

interface ChoiceFilterProps<T extends string> {
  /** The panel's name, for a screen reader. */
  readonly title: string
  /** The chip's text, naming the kept choice. */
  readonly chip: string
  readonly leading?: ReactNode
  readonly options: readonly T[]
  readonly label: (option: T) => string
  readonly value: T
  /** The choice that leaves the list as it is; the chip is mint for any other. */
  readonly defaultValue: T
  readonly onChange: (value: T) => void
}

/**
 * A toolbar chip that opens a panel (a bottom sheet below 640px) of single choices, as the Squads
 * page's sort: one pressable row per choice, the kept one in mint with a check.
 */
export function ChoiceFilter<T extends string>({
  title,
  chip,
  leading,
  options,
  label,
  value,
  defaultValue,
  onChange,
}: ChoiceFilterProps<T>) {
  const [open, setOpen] = useState(false)

  const pick = (next: T) => {
    setOpen(false)
    onChange(next)
  }

  return (
    <Popover
      title={title}
      hideTitle
      bottomSheet
      align="end"
      open={open}
      onOpenChange={setOpen}
      className="p-4 sm:w-72 sm:max-w-[calc(100vw-2rem)]"
      trigger={
        <FilterChip open={open} active={value !== defaultValue} label={chip} leading={leading} />
      }
    >
      <div role="group" aria-label={title} className="flex flex-col gap-0.5">
        {options.map((option) => {
          const selected = option === value
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => pick(option)}
              className={cn(
                'press focus-visible:outline-mint hover-fine:bg-raised-2 flex min-h-11 items-center justify-between gap-3 px-3 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
                selected ? 'text-mint' : 'text-text-2 hover-fine:text-text'
              )}
            >
              <span className="min-w-0 break-words">{label(option)}</span>
              {selected && (
                <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.6} />
              )}
            </button>
          )
        })}
      </div>
    </Popover>
  )
}
