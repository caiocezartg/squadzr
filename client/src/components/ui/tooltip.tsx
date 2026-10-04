import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TooltipProps {
  /** Text revealed on hover/focus and exposed to assistive technology. */
  label: string
  children: ReactNode
}

/**
 * Accessible tooltip for inline status indicators. The trigger is keyboard
 * focusable, the content is linked through `aria-describedby`, revealed on
 * hover and `:focus-visible`, kept visible while the pointer is over the
 * content (WCAG 1.4.13 Hoverable), and dismissed with Escape from anywhere
 * until hover/focus leaves the trigger.
 *
 * The hidden content is `invisible`, not just transparent, so it never
 * intercepts the pointer where it would appear. A transparent bridge covers
 * the gap between the trigger and the content, so the pointer can travel onto
 * it without the reveal dropping on the way.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const id = useId()
  const [dismissed, setDismissed] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    if (!revealed || dismissed) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissed(true)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [revealed, dismissed])

  const reveal = () => setRevealed(true)
  const conceal = () => {
    setRevealed(false)
    setDismissed(false)
  }

  return (
    <span
      tabIndex={0}
      aria-describedby={id}
      className="group relative inline-flex items-center"
      onFocus={reveal}
      onBlur={conceal}
      onMouseEnter={reveal}
      onMouseLeave={conceal}
    >
      {children}
      <span
        role="tooltip"
        id={id}
        className={cn(
          'invisible absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-light px-2 py-1 text-xs font-medium text-offwhite opacity-0 shadow-lg transition-[opacity,visibility]',
          // Bridges the `mb-1.5` gap so the pointer can move from the trigger
          // onto the content without the hover dropping.
          "before:absolute before:inset-x-0 before:top-full before:h-1.5 before:content-['']",
          !dismissed &&
            'group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100'
        )}
      >
        {label}
      </span>
    </span>
  )
}
