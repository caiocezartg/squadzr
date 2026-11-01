'use client'

import { useRef, type CSSProperties } from 'react'
import { Pause, Play } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { SHOWCASE_SQUADS, squadSize } from './hero-showcase-data'
import { ShowcaseSquadCard } from './showcase-squad-card'
import { useSquadShowcase } from './use-squad-showcase'

/** Cards further than this from the centre are out of sight; the one that wraps around travels there. */
const VISIBLE_REACH = 2

/** Where squad `index` stands relative to `active`, the shorter way around the ring. */
function offsetOf(index: number, active: number): number {
  const count = SHOWCASE_SQUADS.length
  let offset = (index - active + count) % count
  if (offset > count / 2) offset -= count
  return offset
}

/** How a card at `offset` from the centre is placed: further out, smaller, dimmer and further back. */
function placement(offset: number): CSSProperties {
  const distance = Math.abs(offset)
  const scale = distance === 0 ? 1 : distance === 1 ? 0.8 : 0.64
  return {
    transform: `translateX(calc(${offset} * var(--showcase-step))) scale(${scale})`,
    opacity: distance === 0 ? 1 : distance === 1 ? 0.42 : distance === 2 ? 0.14 : 0,
    zIndex: 10 - distance,
  }
}

interface DotsProps {
  readonly active: number
  readonly filled: number
  readonly onSelect: (index: number) => void
}

/** The queue under the carousel: one bar per squad. The centre squad's bar fills as its seats do. */
function ShowcaseDots({ active, filled, onSelect }: DotsProps) {
  const t = useTranslations('landing.showcase')

  return (
    <ul className="flex items-center gap-1.5">
      {SHOWCASE_SQUADS.map((squad, index) => {
        const current = index === active
        return (
          <li key={squad.code}>
            <button
              type="button"
              aria-label={t('goTo', { name: squad.name, game: squad.game })}
              aria-current={current ? 'true' : undefined}
              onClick={() => onSelect(index)}
              className="group/dot focus-visible:outline-mint flex h-6 items-center px-0.5 focus-visible:outline-2"
            >
              <span
                className={cn(
                  'bg-track relative block h-1 overflow-hidden transition-[width] duration-300 ease-out',
                  current ? 'w-8' : 'group-hover/dot:bg-line w-3'
                )}
              >
                {current && (
                  <span
                    className="bg-mint absolute inset-0 origin-left transition-transform duration-500 ease-out"
                    style={{ transform: `scaleX(${filled / squadSize(squad)})` }}
                  />
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The hero's carousel: squads filling up while the viewer watches. The centre squad stands forward and
 * its players join one by one; once it is full it says so, holds, and the next squad in the queue slides
 * in. The ones beside it wait, smaller and dimmer: those already past are full, those to come are still
 * filling. It stops while the pointer or the focus is on it, and the pause control stops it for good; the
 * bars below bring any squad to the centre. Under reduced motion it never moves on its own.
 */
export function HeroSquadShowcase() {
  const t = useTranslations('landing.showcase')
  const root = useRef<HTMLDivElement>(null)
  const show = useSquadShowcase(root)

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription={t('roleDescription')}
      aria-label={t('label')}
      onPointerEnter={(event) => {
        // A tap is no hover: on a touch screen the carousel keeps going.
        if (event.pointerType !== 'touch') show.setHeld(true)
      }}
      onPointerLeave={() => show.setHeld(false)}
      onFocus={() => show.setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) show.setHeld(false)
      }}
      className="flex w-full flex-col items-center gap-5 sm:gap-6"
    >
      <div
        className={cn(
          'relative -my-10 h-64 w-full overflow-x-clip [--showcase-card:min(86vw,460px)] [--showcase-step:calc(var(--showcase-card)*0.86)] lg:h-[18.375rem] lg:[--showcase-card:540px]',
          // The far cards fade into the page at the edges. The mask clips on every side, so the box reaches
          // 40px past the cards above and below, where the centre card's glow falls.
          'mask-x-from-85% mask-x-to-100% sm:mask-x-from-75%'
        )}
      >
        {SHOWCASE_SQUADS.map((squad, index) => {
          const offset = offsetOf(index, show.active)
          const centered = offset === 0
          // Squads already past are full; those still to come wait with their founders in.
          const filled = centered ? show.filled : offset < 0 ? squadSize(squad) : squad.founders
          const hidden = Math.abs(offset) > VISIBLE_REACH

          return (
            <div
              key={squad.code}
              role={centered ? 'group' : undefined}
              aria-roledescription={centered ? t('slide') : undefined}
              aria-label={
                centered
                  ? t('squadLabel', {
                      name: squad.name,
                      game: squad.game,
                      count: show.filled,
                      total: squadSize(squad),
                    })
                  : undefined
              }
              aria-hidden={centered ? undefined : true}
              inert={!centered}
              className={cn(
                'absolute inset-y-10 left-1/2 -ml-[calc(var(--showcase-card)/2)] w-(--showcase-card) origin-center',
                // A card that wraps around from one end to the other moves out of sight, with no transition.
                hidden
                  ? 'transition-none'
                  : 'transition-[transform,opacity] duration-700 ease-[cubic-bezier(0.65,0,0.35,1)]'
              )}
              style={placement(offset)}
            >
              <ShowcaseSquadCard
                squad={squad}
                filled={filled}
                centered={centered}
                scripted={show.scripted}
              />
            </div>
          )
        })}
      </div>

      <div className="relative z-20 flex items-center gap-3">
        {show.animated && (
          <button
            type="button"
            onClick={show.togglePause}
            aria-label={show.paused ? t('play') : t('pause')}
            className="text-ds-muted hover-fine:text-text focus-visible:outline-mint flex size-8 items-center justify-center focus-visible:outline-2"
          >
            {show.paused ? (
              <Play aria-hidden className="size-3.5 fill-current" />
            ) : (
              <Pause aria-hidden className="size-3.5 fill-current" />
            )}
          </button>
        )}
        <ShowcaseDots active={show.active} filled={show.filled} onSelect={show.goTo} />
      </div>
    </div>
  )
}
