'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { NARROW_QUERY, useMediaQuery } from '@/components/ds/use-media-query'
import { Reveal } from '@/components/ui/reveal'
import { cn } from '@/lib/utils'
import type { PopularGame } from '@/types'
import { GameTower } from './game-tower'
import { SectionEyebrow } from './section-eyebrow'

/** Below 1024px: the medium widths of docs/design/reference.md, Responsive. */
const BELOW_WIDE_QUERY = '(max-width: 1023px)'

/** How many towers fit at each width: narrow, medium and wide. */
const TOWERS = { narrow: 3, medium: 6, wide: 8 } as const

/** The towers each width hides, so a tower's place in the row matches `useTowerCount`. */
function towerVisibility(index: number): string | undefined {
  if (index >= TOWERS.wide) return 'hidden'
  if (index >= TOWERS.medium) return 'max-lg:hidden'
  if (index >= TOWERS.narrow) return 'max-sm:hidden'
  return undefined
}

function useTowerCount(games: number): number {
  const narrow = useMediaQuery(NARROW_QUERY)
  const belowWide = useMediaQuery(BELOW_WIDE_QUERY)
  const fits = narrow ? TOWERS.narrow : belowWide ? TOWERS.medium : TOWERS.wide
  return Math.min(fits, games)
}

/**
 * The towers' resize and a little more. A mouse "move" before the row settles is the row sliding under
 * a resting mouse, not the visitor pointing at a tower.
 */
const SETTLE_MS = 550

/** Whether the element is on screen. Without an observer (old browsers, tests) it counts as seen. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null)
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setOnScreen(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? false)
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, onScreen] as const
}

/**
 * The landing's games: a row of towers, one per popular game. One tower is open at a time and shows
 * the whole cover, the genre and the name; the others are dim slices of their covers. The open tower
 * passes to the next one on its own, and holds while the row is off screen, hovered or focused. A
 * tower opens on hover and focus, and leads to its game's Squads. Under reduced motion it does not
 * pass on its own, and a tower opens at once.
 */
export function PopularGames({ games }: PopularGamesProps) {
  const t = useTranslations('landing.games')
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [rowRef, onScreen] = useOnScreen<HTMLUListElement>()
  const count = useTowerCount(games.length)
  // A narrower window can hide the open tower; the first one opens then.
  const open = active < count ? active : 0
  const paused = hovered || focused || !onScreen
  const settledAt = useRef(0)

  useEffect(() => {
    settledAt.current = performance.now() + SETTLE_MS
  }, [open])

  const openFromMouse = (index: number) => {
    if (performance.now() >= settledAt.current) setActive(index)
  }

  return (
    <section id="jogos" className="bg-menu scroll-mt-20 px-4 pt-24 pb-30 sm:px-6">
      <div className="mx-auto flex max-w-310 flex-col gap-12">
        <Reveal stagger className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex max-w-160 flex-col gap-3.5">
            <SectionEyebrow>{t('label')}</SectionEyebrow>
            <h2 className="type-section-title text-balance">{t('title')}</h2>
          </div>
          <p className="text-text-3 max-w-95 text-base/[1.6]">{t('subtitle')}</p>
        </Reveal>

        {games.length > 0 && (
          <Reveal>
            <ul
              ref={rowRef}
              aria-label={t('listLabel')}
              // Only a mouse holds the row: a touch leaves the row "hovered" after the tap.
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') setHovered(true)
              }}
              onPointerLeave={() => setHovered(false)}
              onFocus={() => setFocused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
              }}
              className="flex h-(--tower-h) gap-1.5 [--tower-h:20rem] sm:gap-2 sm:[--tower-h:26rem] lg:[--tower-h:32rem]"
            >
              {games.map((entry, index) => (
                <li
                  key={entry.game.id}
                  className={cn(
                    // No tower grows past the open width, so a short catalog does not stretch a
                    // closed slice across the row.
                    'flex max-w-[calc(var(--tower-h)*0.75)] min-w-0 transition-[flex-grow,flex-basis] duration-500 ease-(--ease-in-out)',
                    index === open ? 'grow-0 basis-[calc(var(--tower-h)*0.75)]' : 'grow basis-0',
                    towerVisibility(index)
                  )}
                >
                  <GameTower
                    entry={entry}
                    open={index === open}
                    timed={count > 1}
                    paused={paused}
                    onFocus={() => setActive(index)}
                    onMouseOpen={() => openFromMouse(index)}
                    onTimeUp={() => setActive((open + 1) % count)}
                  />
                </li>
              ))}
            </ul>
          </Reveal>
        )}
      </div>
    </section>
  )
}

interface PopularGamesProps {
  /** The games the server ranked: open Squads first, then the Featured Games on a quiet day. */
  readonly games: readonly PopularGame[]
}
