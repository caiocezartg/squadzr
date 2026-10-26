'use client'

import { useId, useRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'
import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  /** Whether the list the input controls is showing. */
  expanded: boolean
  /** The id of the list the input controls. */
  controls: string
}

interface SearchFieldProps extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'onChange' | 'type' | 'role' | 'size' | 'children'
> {
  /** The input's accessible name; it is visually hidden. */
  label: string
  value: string
  onChange: (value: string) => void
  /** `field` stands alone with its own ground; `bare` sits inside a bar that has one. */
  variant?: 'field' | 'bare'
  /** Turns the input into a combobox for a list the parent renders. */
  combobox?: ComboboxProps
  /** Runs when the clear button empties the field, after `onChange('')`. */
  onClear?: () => void
}

/** A search input with a leading icon and a clear button once it has a value. */
export function SearchField({
  label,
  value,
  onChange,
  variant = 'field',
  combobox,
  onClear,
  className,
  id,
  ...inputProps
}: SearchFieldProps) {
  const t = useTranslations('ds.searchField')
  const generatedId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)
  const field = variant === 'field'
  const hasValue = value.length > 0

  const clear = () => {
    onChange('')
    onClear?.()
    inputRef.current?.focus()
  }

  return (
    <div
      className={cn(
        'font-body flex w-full items-center gap-2.5',
        field
          ? 'min-h-13.5 bg-[#0c0d10] pr-2 pl-4 shadow-[inset_0_0_0_1.5px_var(--color-track)] focus-within:shadow-[inset_0_0_0_1.5px_var(--color-mint)]'
          : 'min-h-11.5 pr-1.5 pl-3',
        field && hasValue && 'shadow-[inset_0_0_0_1.5px_var(--color-mint)]',
        className
      )}
    >
      <Search aria-hidden className="text-ds-muted size-4.5 shrink-0" strokeWidth={2.4} />
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        {...inputProps}
        ref={inputRef}
        id={inputId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...(combobox
          ? {
              type: 'text',
              role: 'combobox',
              'aria-expanded': combobox.expanded,
              'aria-controls': combobox.controls,
              'aria-autocomplete': 'list',
              autoComplete: 'off',
            }
          : { type: 'search' })}
        className={cn(
          'text-text placeholder:text-faint min-w-0 flex-1 appearance-none border-0 bg-transparent py-3.25 outline-none',
          '[&::-webkit-search-cancel-button]:hidden',
          field ? 'text-base font-semibold' : 'text-[15px] font-medium'
        )}
      />
      {hasValue && (
        <button
          type="button"
          aria-label={t('clear')}
          onClick={clear}
          className="press bg-raised-2 text-text-3 focus-visible:outline-text hover-fine:text-text flex size-9.5 shrink-0 items-center justify-center focus-visible:outline-2 focus-visible:-outline-offset-2"
        >
          <X aria-hidden className="size-3.25" strokeWidth={2.8} />
        </button>
      )}
    </div>
  )
}
