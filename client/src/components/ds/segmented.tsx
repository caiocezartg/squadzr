'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedProps<T extends string> {
  /** The group's accessible name, e.g. "Language". */
  label: string
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  /** `sm` is the mono language switch; `md` is for squad language, sort and filter language. */
  size?: 'sm' | 'md'
  /** Stretches the control to its container, with equal segments. */
  fluid?: boolean
  /** Locks every segment; `describedBy` should then point at the text that says why. */
  disabled?: boolean
  /** The id of the text that describes the group, such as why it is disabled. */
  describedBy?: string
  className?: string
}

/** A labelled group of toggle buttons where one is pressed. The parent owns the value. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  fluid = false,
  disabled = false,
  describedBy,
  className,
}: SegmentedProps<T>) {
  const small = size === 'sm'

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn(
        'box-border',
        fluid ? 'flex w-full' : 'inline-flex',
        small ? 'bg-card p-0.75' : 'bg-[#0c0d10] p-1 shadow-[inset_0_0_0_1px_var(--color-line)]',
        className
      )}
    >
      {options.map((option) => {
        const pressed = option.value === value

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'press focus-visible:outline-text focus-visible:outline-2 focus-visible:-outline-offset-2',
              fluid && 'flex-1',
              small
                ? 'font-mono min-h-9 px-2.25 text-[11px] font-bold'
                : 'type-ui min-h-11 px-4 text-[13px]',
              pressed ? 'bg-mint text-mint-ink' : 'text-text-3 hover-fine:text-text bg-transparent',
              'disabled:cursor-not-allowed',
              disabled && (pressed ? 'bg-track text-text-3' : 'text-faint hover-fine:text-faint')
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
