import type { ComponentProps, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterChipProps = ComponentProps<'button'> & {
  readonly open: boolean
  /** Marks a chip whose control holds a non-default value. */
  readonly active: boolean
  readonly label: string
  /** Drawn before the label, such as an icon. */
  readonly leading?: ReactNode
  /** Drawn after the label, such as the count of active filters. */
  readonly trailing?: ReactNode
}

/**
 * A toolbar chip that opens a popover. The popover hands its trigger behaviour to this element, so it
 * spreads what it is given onto the button. It is mint while its control narrows or reorders the list,
 * and inverted while its panel is open.
 */
export function FilterChip({
  open,
  active,
  label,
  leading,
  trailing,
  ...triggerProps
}: FilterChipProps) {
  return (
    <button
      type="button"
      {...triggerProps}
      className={cn(
        'press focus-visible:outline-mint font-body inline-flex min-h-13.5 max-w-full shrink-0 items-center gap-2 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2',
        open
          ? 'bg-text text-bg'
          : active
            ? 'bg-raised-2 text-mint hover-fine:bg-track'
            : 'bg-raised-2 text-text hover-fine:bg-track'
      )}
    >
      {leading}
      <span className="min-w-0 truncate">{label}</span>
      {trailing}
      <ChevronDown aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
    </button>
  )
}
