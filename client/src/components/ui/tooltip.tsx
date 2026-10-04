import { useId, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  /** Text revealed on hover/focus and exposed to assistive technology. */
  label: string
  children: ReactNode
}

/**
 * Accessible tooltip for inline status indicators. The trigger is keyboard
 * focusable, the content is linked through `aria-describedby`, revealed on
 * hover and `:focus-visible`, and dismissed with Escape until hover/focus
 * leaves the trigger.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const id = useId()
  const [dismissed, setDismissed] = useState(false)

  const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Escape') setDismissed(true)
  }

  return (
    <span
      tabIndex={0}
      aria-describedby={id}
      className="group relative inline-flex items-center"
      onKeyDown={handleKeyDown}
      onBlur={() => setDismissed(false)}
      onMouseLeave={() => setDismissed(false)}
    >
      {children}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-light px-2 py-1 text-xs font-medium text-offwhite opacity-0 shadow-lg transition-opacity',
          !dismissed && 'group-hover:opacity-100 group-focus-visible:opacity-100'
        )}
      >
        {label}
      </span>
    </span>
  )
}
