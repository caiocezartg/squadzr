import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CopySwapProps {
  /** The resting face: a label and its icon. */
  readonly idle: ReactNode
  /** The face that confirms the copy. */
  readonly done: ReactNode
  readonly copied: boolean
}

const FACE =
  'transition-[opacity,filter] duration-200 ease-out col-start-1 row-start-1 inline-flex items-center justify-center gap-[inherit]'

/**
 * The copy feedback (reference, Per element): the label and icon crossfade with a 2px blur over 200ms.
 * Both faces stay in place, stacked in one grid cell, so the button keeps the width of the wider one
 * and never jumps. Both are hidden from assistive technology: the button's own accessible name carries
 * the state.
 */
export function CopySwap({ idle, done, copied }: CopySwapProps) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid items-center justify-items-center gap-[inherit]"
    >
      <span className={cn(FACE, copied && 'opacity-0 blur-[2px]')}>{idle}</span>
      <span className={cn(FACE, !copied && 'opacity-0 blur-[2px]')}>{done}</span>
    </span>
  )
}
