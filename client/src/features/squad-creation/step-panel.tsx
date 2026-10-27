import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StepDirection = 'forward' | 'back'

interface StepPanelProps {
  /** Changing it mounts a new panel, which plays the entrance. */
  step: string
  /** Where the player came from; none for the step the dialog opens on, which does not animate. */
  direction: StepDirection | null
  /**
   * Bounds the step to the dialog's height on a phone so a list inside can scroll within it (the
   * game step); the other steps keep their natural height and the dialog scrolls instead.
   */
  fill?: boolean
  children: ReactNode
}

/**
 * One step's content. A new step slides 12px in the travel direction while it fades in, 240ms
 * `--ease-out`; reduced motion keeps the fade only. The dialog scrolls vertically, which makes its
 * horizontal overflow scroll too, so the viewport clips the slide's 12px instead of letting it
 * flash a scrollbar; `clip` leaves the vertical axis (and the focus rings inside the padding) alone.
 */
export function StepPanel({ step, direction, fill, children }: StepPanelProps) {
  return (
    <div className={cn('flex flex-1 flex-col overflow-x-clip', fill && 'max-sm:min-h-0')}>
      <div
        key={step}
        className={cn(
          'flex flex-1 flex-col gap-5 px-6 pt-6 pb-6 sm:min-h-95',
          fill && 'max-sm:min-h-72',
          direction && 'transition-[opacity,translate] duration-240 ease-out starting:opacity-0',
          direction === 'forward' && 'motion-safe:starting:translate-x-3',
          direction === 'back' && 'motion-safe:starting:-translate-x-3'
        )}
      >
        {children}
      </div>
    </div>
  )
}
