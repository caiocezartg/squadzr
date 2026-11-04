'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Tag } from '@/components/ds/tag'
import { cn } from '@/lib/utils'

export interface ChoiceChipOption<T extends string> {
  readonly value: T
  readonly label: string
}

interface ChoiceChipsProps<T extends string> {
  /** The group's accessible name, e.g. "Platform". */
  readonly label?: string
  /** The id of the element that names the group, when a visible label already does. */
  readonly labelledBy?: string
  /** Marks the group invalid, e.g. while a required choice is missing. */
  readonly invalid?: boolean
  /** The id of the element that describes the group, such as its error message. */
  readonly describedBy?: string
  readonly options: readonly ChoiceChipOption<T>[]
  /** The chosen option, or `null` while none is. */
  readonly value: T | null
  readonly onChange: (value: T) => void
  readonly className?: string
}

/**
 * A single choice among toggle chips, wrapping onto more lines when they do not fit. It is a
 * `radiogroup`: the chosen chip (or the first, while none is chosen) is the one tab stop, and the
 * arrow keys move the choice, as they do on native radios; Home and End move it to the first and last. The parent owns the value.
 */
export function ChoiceChips<T extends string>({
  label,
  labelledBy,
  invalid = false,
  describedBy,
  options,
  value,
  onChange,
  className,
}: ChoiceChipsProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null)
  const tabStop = options.some((option) => option.value === value) ? value : options[0]?.value

  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = nextOption(event.key)
    if (!next) return
    event.preventDefault()

    onChange(next.value)
    // The chosen chip becomes the tab stop on the next render; focus follows the choice.
    const chips = groupRef.current?.querySelectorAll<HTMLElement>('[role="radio"]')
    chips?.[options.indexOf(next)]?.focus()
  }

  // Home and End jump to the first and last chip; the arrows step and wrap around.
  function nextOption(key: string): ChoiceChipOption<T> | undefined {
    if (options.length === 0) return undefined
    if (key === 'Home') return options[0]
    if (key === 'End') return options[options.length - 1]
    const step = ARROW_STEPS[key]
    if (step === undefined) return undefined
    const current = options.findIndex((option) => option.value === (value ?? tabStop))
    return options[(Math.max(current, 0) + step + options.length) % options.length]
  }

  return (
    // The arrow keys bubble up from the focused chip, the way a radiogroup handles them.
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
      onKeyDown={move}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((option) => (
        <Tag
          key={option.value}
          variant="toggle"
          choice
          label={option.label}
          pressed={option.value === value}
          tabIndex={option.value === tabStop ? 0 : -1}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}

const ARROW_STEPS: Record<string, number | undefined> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}
