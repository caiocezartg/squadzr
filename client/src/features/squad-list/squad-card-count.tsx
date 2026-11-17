import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** When an arrival's count starts rolling, and how far apart its steps are: one per seat. */
const STEP_START_MS = 120
const STEP_STAGGER_MS = 250

interface SquadCardCountProps {
  readonly members: number
  readonly max: number
  /** The count before a live arrival, which the count rolls up from; `members` when there is none. */
  readonly from: number
  /** The viewer is a member: the number is mint. */
  readonly mint: boolean
  /** An open card: on hover the count rolls one step, to the viewer's seat, and turns mint. */
  readonly rollsOnHover: boolean
  /** A full card the viewer has not joined: the number dims. */
  readonly muted: boolean
}

/**
 * The card's count in Anton, an odometer like the hero's: a column of one row per count, `members`
 * showing. A live arrival starts the column on the old count and rolls it one row per new member,
 * each step on its own wrapper; an open card's hover rolls it one row more. Only the row showing is
 * read by assistive tech, and the card's name carries the count anyway.
 */
export function SquadCardCount({
  members,
  max,
  from,
  mint,
  rollsOnHover,
  muted,
}: SquadCardCountProps) {
  const last = members + (rollsOnHover ? 1 : 0)
  const rows = Array.from({ length: last - from + 1 }, (_, index) => from + index)

  let column: ReactNode = (
    <span
      className={cn(
        'block translate-y-[calc((var(--row)+var(--lift))*-1.1em)] [--lift:0]',
        rollsOnHover &&
          'transition-[translate,color] duration-450 ease-out card-lit:text-mint card-lit:[--lift:1]'
      )}
      style={{ '--row': members - from } as CSSProperties}
    >
      {rows.map((count) => (
        <span
          key={count}
          aria-hidden={count === members ? undefined : true}
          className="block h-[1.1em] leading-[1.1]"
        >
          {count}
        </span>
      ))}
    </span>
  )

  // Each step's wrapper holds the column one row down until its turn, then rolls it up a row.
  for (let step = members - from - 1; step >= 0; step -= 1) {
    column = (
      <span
        className="block motion-safe:animate-card-count-step"
        style={{ animationDelay: `${STEP_START_MS + step * STEP_STAGGER_MS}ms` }}
      >
        {column}
      </span>
    )
  }

  return (
    <span className="flex shrink-0 items-start font-hero text-[32px] leading-none lg:text-[44px]">
      <span
        className={cn(
          'block h-[1.1em] overflow-hidden',
          mint ? 'text-mint' : muted ? 'text-text-3' : 'text-text'
        )}
      >
        {column}
      </span>
      <span className="block h-[1.1em] leading-[1.1] text-faint">/{max}</span>
    </span>
  )
}
