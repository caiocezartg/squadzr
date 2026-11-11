import type { AnimationEvent, PointerEvent } from 'react'
import { useTranslations } from 'next-intl'
import { AppLink } from '@/components/layout/app-link'
import { cn } from '@/lib/utils'
import type { PopularGame } from '@/types'

/** The board filtered by the game's name. */
function gameSquadsHref(name: string): string {
  return `/squads?search=${encodeURIComponent(name)}`
}

interface GameTowerProps {
  readonly entry: PopularGame
  /** The open tower shows the whole cover, the genre and the name; the others are dim slices. */
  readonly open: boolean
  /** Whether the open tower has a timer: a lone tower has no next one to pass to. */
  readonly timed: boolean
  /** Holds the open tower's timer where it is. */
  readonly paused: boolean
  /** Opens this tower when it takes focus. */
  readonly onFocus: () => void
  /** Opens this tower when a mouse moves over it; the row decides whether that move counts. */
  readonly onMouseOpen: () => void
  /** The open tower's timer ran out. */
  readonly onTimeUp: () => void
}

/**
 * One tower of the games row: a link to the game's Squads on the board, over its cover. When it is
 * open, a mint timer line fills along its foot, and the next tower opens when the line is full.
 */
export function GameTower({
  entry,
  open,
  timed,
  paused,
  onFocus,
  onMouseOpen,
  onTimeUp,
}: GameTowerProps) {
  const t = useTranslations('landing.games')
  const { game } = entry
  const genre = game.genres[0]?.name
  const label = genre
    ? t('tower', { name: game.name, genre })
    : t('towerNoGenre', { name: game.name })

  // A tower that grows or shrinks slides others under a resting mouse, and the browser reports that as
  // the mouse entering them. Only a mouse that really moves opens a tower, so the row never chases it.
  const handlePointerMove = (event: PointerEvent<HTMLAnchorElement>) => {
    if (open || event.pointerType !== 'mouse') return
    if (event.movementX !== 0 || event.movementY !== 0) onMouseOpen()
  }

  const handleAnimationEnd = (event: AnimationEvent<HTMLAnchorElement>) => {
    if (event.animationName === 'tower-progress') onTimeUp()
  }

  return (
    <AppLink
      href={gameSquadsHref(game.name)}
      aria-label={label}
      data-open={open}
      onPointerMove={handlePointerMove}
      onFocus={onFocus}
      onAnimationEnd={handleAnimationEnd}
      className="bg-raised-2 focus-visible:outline-mint relative block size-full overflow-hidden focus-visible:-outline-offset-2 focus-visible:outline-2"
    >
      <img
        src={game.coverUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn(
          'absolute inset-0 size-full object-cover transition-[filter] duration-500 ease-(--ease-in-out)',
          !open && 'brightness-[0.42] saturate-[0.35]'
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/90 to-transparent transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
      />
      {/* The caption keeps the open width while the tower grows, so its text never reflows. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute bottom-0 left-0 flex w-[calc(var(--tower-h)*0.75)] flex-col gap-1.5 p-5 transition-[opacity,translate] sm:p-6',
          open
            ? 'translate-y-0 opacity-100 delay-200 duration-300 ease-(--ease-out)'
            : 'translate-y-2 opacity-0 duration-150 ease-out'
        )}
      >
        {genre && (
          <span className="font-mono text-mint text-[11px] font-bold tracking-[0.14em] uppercase">
            {genre}
          </span>
        )}
        <span className="font-display text-text text-[clamp(26px,2.6vw,38px)] leading-none font-black text-balance uppercase">
          {game.name}
        </span>
      </span>
      {/* The line is empty until the animation fills it, even if the animation never runs. It is a
          `transform`, which the keyframes override: a `scale-x-0` would set `scale`, which multiplies
          with the keyframes' `transform` and keeps the line empty to the end. */}
      {open && timed && (
        <span
          aria-hidden="true"
          data-timer=""
          className="bg-mint motion-safe:animate-tower-progress absolute inset-x-0 bottom-0 h-0.75 origin-left [transform:scaleX(0)] motion-reduce:hidden"
          style={{ animationPlayState: paused ? 'paused' : 'running' }}
        />
      )}
    </AppLink>
  )
}
