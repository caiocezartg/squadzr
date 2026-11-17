'use client'

import { useRef, type RefObject } from 'react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/ds/avatar'
import { cn } from '@/lib/utils'
import { SQUAD_SIZE, SQUADMATES, type Squadmate } from './hero-solo-data'
import { squadmateTiming } from './hero-timeline'
import { useSquadmateSpots } from './use-squadmate-spots'

/** A seat of the rail: the board's vacant circle, cut out of the one before it by a ring of the page ground. */
const SEAT =
  'relative size-(--seat) shrink-0 rounded-full bg-[#2a2b31] shadow-[inset_0_0_0_1px_#3a3b42,0_0_0_4px_var(--color-bg)] not-first:-ml-[11px] sm:not-first:-ml-2.5'

/** The name under a player while the story waits; it leaves as the story moves on. From 640px only. */
const NAME =
  'absolute top-full left-1/2 mt-2.5 -translate-x-1/2 font-mono text-[11px] font-bold tracking-[0.08em] whitespace-nowrap opacity-0 motion-safe:animate-hero-label-out max-sm:hidden'

/** The visitor's seat, taken from the start: a mint "you". */
function VisitorSeat() {
  const t = useTranslations('landing.hero')

  return (
    <span className={SEAT}>
      <span className="bg-mint text-mint-ink absolute inset-0 z-3 flex items-center justify-center rounded-full text-[length:calc(var(--seat)*0.32)] font-extrabold shadow-[0_0_0_4px_var(--color-bg)]">
        {t('you')}
      </span>
    </span>
  )
}

interface SquadmateSeatProps {
  readonly squadmate: Squadmate
  /** Its turn to land, which times its flight. */
  readonly index: number
  readonly flyerRef: (element: HTMLElement | null) => void
}

/**
 * A seat a squadmate lands in. The player floats at its spot close to the headline (placed by
 * `useSquadmateSpots`), a little larger than the seat and named, bobbing; then it flies in, settles to
 * the seat's size, and the seat flashes its ring. At rest the player is in the seat, which is how
 * reduced motion shows it; with motion the player only shows once placed, so it never appears in the
 * seat before it flies.
 */
function SquadmateSeat({ squadmate, index, flyerRef }: SquadmateSeatProps) {
  return (
    <span className={SEAT} style={squadmateTiming(index)}>
      <span
        ref={flyerRef}
        className="motion-safe:animate-hero-fly absolute inset-0 z-3 transition-opacity duration-500 motion-safe:[&:not([data-placed])]:opacity-0"
      >
        <span className="motion-safe:animate-hero-appear block size-full">
          <span className="motion-safe:animate-hero-bob before:bg-bg relative block size-full rounded-full before:absolute before:-inset-1 before:rounded-full">
            {/* The avatar's 72px drawing, scaled to the seat: 44px, and 60px from 640px. A solid disc of the page
                ground 4px wider sits behind it, so its edge never lets the seat before it show through. */}
            <span className="relative block origin-top-left scale-[0.6111] sm:scale-[0.8333]">
              <Avatar size={72} playerId={squadmate.id} name={squadmate.name} />
            </span>
            <span className={cn(NAME, 'text-text')}>{squadmate.name}</span>
          </span>
        </span>
      </span>
      <span className="border-mint motion-safe:animate-hero-ping absolute -inset-0.75 z-4 rounded-full border-2 opacity-0" />
    </span>
  )
}

/** The counts the counter rolls through, one row each: the visitor alone up to the full squad. */
const COUNTS = Array.from({ length: SQUAD_SIZE }, (_, index) => index + 1)

/**
 * The squad's count in Anton, an odometer of one row per count. At rest it reads the full squad in
 * mint; the story starts it on 1, rolls it a step per landing and turns it mint with the last one.
 */
function SquadCount() {
  return (
    <span className="font-hero flex items-center text-[34px] leading-none sm:text-[46px]">
      <span className="text-mint motion-safe:animate-hero-count-full block h-[1.1em] overflow-hidden">
        {/* At rest, the last row: (SQUAD_SIZE - 1) rows of 1.1em up. */}
        <span className="motion-safe:animate-hero-count block [transform:translateY(-4.4em)]">
          {COUNTS.map((count) => (
            <span key={count} className="block h-[1.1em] leading-[1.1]">
              {count}
            </span>
          ))}
        </span>
      </span>
      <span className="text-faint">/{SQUAD_SIZE}</span>
    </span>
  )
}

/**
 * The visitor's squad under the headline: their own seat, four vacant ones and the count. The four
 * players who complete it float around the hero until the strike, then fly into their seats one after
 * another as the count rolls to full. It is all illustration; the headline says it in words.
 */
export function HeroSquadRail({ headline }: { readonly headline: RefObject<HTMLElement | null> }) {
  const flyers = useRef<(HTMLElement | null)[]>([])
  useSquadmateSpots(headline, flyers)

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none flex items-center gap-3 [--seat:44px] sm:gap-5 sm:[--seat:60px]"
    >
      <span className="flex">
        <VisitorSeat />
        {SQUADMATES.map((squadmate, index) => (
          <SquadmateSeat
            key={squadmate.id}
            squadmate={squadmate}
            index={index}
            flyerRef={(element) => {
              flyers.current[index] = element
            }}
          />
        ))}
      </span>
      <SquadCount />
    </div>
  )
}
