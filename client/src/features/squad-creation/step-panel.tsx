import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StepDirection = 'forward' | 'back'

interface StepPanelProps {
  /** Changing it mounts a new panel, which plays the entrance. */
  step: string
  /** Where the player came from; none for the step the dialog opens on, which does not animate. */
  direction: StepDirection | null
  children: ReactNode
}

/**
 * One step's content. A new step slides 12px in the travel direction while it fades in, 240ms
 * `--ease-out`; reduced motion keeps the fade only.
 */
export function StepPanel({ step, direction, children }: StepPanelProps) {
  return (
    <div
      key={step}
      className={cn(
        'flex flex-1 flex-col gap-5 px-6 pt-6 pb-6 sm:min-h-95',
        direction && 'transition-[opacity,translate] duration-240 ease-out starting:opacity-0',
        direction === 'forward' && 'motion-safe:starting:translate-x-3',
        direction === 'back' && 'motion-safe:starting:-translate-x-3'
      )}
    >
      {children}
    </div>
  )
}
