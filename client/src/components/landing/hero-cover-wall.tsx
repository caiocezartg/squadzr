import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { coverUrl, WALL_COVER_IDS } from './hero-showcase-data'

/** Columns of the wall, and how many covers each one carries before it repeats. */
const COLUMNS = 8
const COVERS_PER_COLUMN = 6
/** How long a column takes to travel one full set of its covers. Neighbours differ, so the wall never moves as one. */
const COLUMN_SECONDS = [118, 96, 132, 104, 124, 92, 140, 110] as const

/** Column `index`'s covers: every `COLUMNS`th id from its own start, so each column mixes the catalog. */
function columnCovers(index: number): string[] {
  return Array.from(
    { length: COVERS_PER_COLUMN },
    (_, row) => WALL_COVER_IDS[(index + row * COLUMNS) % WALL_COVER_IDS.length] as string
  )
}

function WallColumn({ index }: { readonly index: number }) {
  const covers = columnCovers(index)
  const seconds = COLUMN_SECONDS[index % COLUMN_SECONDS.length] ?? 120
  // Each column starts part of the way through its journey, and still ones stand at different heights, so
  // their covers never line up in rows.
  const style: CSSProperties = {
    animationDuration: `${seconds}s`,
    animationDelay: `${-((index * 0.37) % 1) * seconds}s`,
    marginTop: `${-((index * 53) % 160)}px`,
  }
  // Three copies of the set: the column travels one set's height and starts again with no seam, and the
  // two copies below the one in travel keep the whole hero covered at every moment.
  const loop = [...covers, ...covers, ...covers]

  return (
    <div
      className={cn(
        'min-w-0 flex-1',
        // Below 640px the outer columns sit off screen anyway.
        (index === 0 || index === COLUMNS - 1) && 'max-sm:hidden'
      )}
    >
      <div
        className={cn(
          'flex flex-col will-change-transform',
          index % 2 === 0 ? 'motion-safe:animate-wall-up' : 'motion-safe:animate-wall-down'
        )}
        style={style}
      >
        {loop.map((id, row) => (
          <span key={row} className="block pb-3 sm:pb-4">
            <img
              src={coverUrl(id)}
              alt=""
              decoding="async"
              fetchPriority="low"
              className="bg-card block aspect-3/4 w-full object-cover"
            />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The hero's backdrop: a wall of game covers, tilted, its columns drifting slowly in turn up and down. It
 * is kept almost out of sight (low opacity, desaturated, and a dark pool under the headline) so it says
 * "every game" without competing with the copy or the squads. The page ground closes it at the bottom, so
 * the hero runs into the next section with no edge, and it reaches up under the clear sticky header.
 * Reduced motion holds it still. It is all decoration.
 */
export function HeroCoverWall() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -top-40 bottom-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-64 left-1/2 flex w-[260%] origin-top -translate-x-1/2 -rotate-12 gap-3 opacity-[0.07] blur-[1.5px] saturate-[0.5] sm:w-[170%] sm:gap-4 lg:w-[150%]">
        {Array.from({ length: COLUMNS }, (_, index) => (
          <WallColumn key={index} index={index} />
        ))}
      </div>
      {/* A dark pool behind the headline and the carousel, the corners in the dark, and the page ground below. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_42%,var(--color-bg)_0%,rgba(7,8,10,0.7)_45%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_45%,transparent_40%,var(--color-bg)_100%)]" />
      <div className="from-bg/80 to-bg absolute inset-0 bg-linear-to-b via-transparent via-50%" />
      {/* The brand's light, faint, rising from behind the carousel. */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[radial-gradient(ellipse_45%_50%_at_50%_70%,rgba(0,255,162,0.07),transparent_70%)]" />
    </div>
  )
}
