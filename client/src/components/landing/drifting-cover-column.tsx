import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { coverUrl, WALL_COVER_IDS } from './hero-showcase-data'

/** A wall's shape: how many columns it has and how many covers each one carries before it repeats. */
export interface CoverWallShape {
  readonly columns: number
  readonly coversPerColumn: number
}

/** Column `index`'s cover ids: every `columns`th id from its own start, so each column mixes the catalog. */
export function columnCovers(
  index: number,
  { columns, coversPerColumn }: CoverWallShape
): string[] {
  return Array.from(
    { length: coversPerColumn },
    (_, row) => WALL_COVER_IDS[(index + row * columns) % WALL_COVER_IDS.length] as string
  )
}

interface DriftingCoverColumnProps {
  /** The column's place in its wall: even columns drift up, odd ones down. */
  readonly index: number
  readonly covers: readonly string[]
  /** How long the column takes to travel one full set of its covers. */
  readonly seconds: number
  /** Extra styles for the travelling strip, such as a start delay or a resting offset. */
  readonly style?: CSSProperties
  readonly className?: string
  /** The space under each cover. */
  readonly gapClassName: string
  readonly imageClassName?: string
  /** Waits for the column to near the viewport before its covers load. */
  readonly lazy?: boolean
}

/**
 * One column of a wall of game covers, drifting on a linear loop that does not run under reduced
 * motion. It carries three copies of its set and travels one set's height, so it starts again with no
 * seam and the copies below keep its whole height covered at every moment. It is decoration.
 */
export function DriftingCoverColumn({
  index,
  covers,
  seconds,
  style,
  className,
  gapClassName,
  imageClassName,
  lazy = false,
}: DriftingCoverColumnProps) {
  const loop = [...covers, ...covers, ...covers]

  return (
    <div className={cn('min-w-0 flex-1', className)}>
      <div
        className={cn(
          'flex flex-col will-change-transform',
          index % 2 === 0 ? 'motion-safe:animate-wall-up' : 'motion-safe:animate-wall-down'
        )}
        style={{ animationDuration: `${seconds}s`, ...style }}
      >
        {loop.map((id, row) => (
          <span key={row} className={cn('block', gapClassName)}>
            <img
              src={coverUrl(id)}
              alt=""
              loading={lazy ? 'lazy' : undefined}
              decoding="async"
              fetchPriority="low"
              className={cn('block aspect-3/4 w-full object-cover', imageClassName)}
            />
          </span>
        ))}
      </div>
    </div>
  )
}
