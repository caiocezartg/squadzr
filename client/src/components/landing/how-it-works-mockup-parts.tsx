'use client'

import { Avatar } from '@/components/ds/avatar'
import { cn } from '@/lib/utils'
import type { MockupMode } from './use-mockup-timeline'

/*
  The parts the three mockups of "Como funciona" share (sign-in-, find-squad- and close-team-mockup.tsx;
  docs/design/Main.dc.html, #como-funciona). Each mockup is a short
  script of beats (use-mockup-timeline.ts) that acts its step out in the product's own look: a pointer,
  hover and press states, a member joining as the hero's carousel draws it, and the Lobby's Discord invite
  unlocking. Every change between beats is a CSS transition on transform and opacity (and colours for
  grounds and rings), so nothing restarts from zero. In the stage each mockup sits on a 380 × 300 frame,
  and the pointer's positions are in that frame. The stacked cards draw the last beat at any width, with
  no pointer.
*/

export interface MockupProps {
  readonly mode: MockupMode
}

export interface Point {
  readonly x: number
  readonly y: number
}

interface PointerProps {
  readonly at: Point
  readonly shown: boolean
  readonly pressed: boolean
}

/** The visitor's pointer: it travels between targets and presses on them. */
export function Pointer({ at, shown, pressed }: PointerProps) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-20 block transition-[transform,opacity] duration-[550ms,200ms] ease-(--ease-in-out)"
      style={{ transform: `translate(${at.x}px, ${at.y}px)`, opacity: shown ? 1 : 0 }}
    >
      <svg
        className="block origin-top-left transition-transform duration-100 ease-out"
        style={{ transform: pressed ? 'scale(0.82)' : 'none' }}
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="var(--color-text)"
        stroke="var(--color-bg)"
        strokeWidth="1.2"
      >
        <path d="M5 2v17l4.6-4.4 3.2 7.2 2.6-1.1-3.1-7.1H19L5 2z" />
      </svg>
    </span>
  )
}

/**
 * A member arriving, as the hero's carousel draws it: a mint disc pops over the seat and fades, and a ring
 * flashes once. It renders only while the beats play; at rest the member is simply there.
 */
export function JoinFlash() {
  return (
    <>
      <span
        aria-hidden="true"
        className="bg-mint motion-safe:animate-seat-burst absolute inset-0 rounded-full opacity-0"
      />
      <span
        aria-hidden="true"
        className="border-mint motion-safe:animate-seat-ping absolute -inset-0.5 rounded-full border-2 opacity-0"
      />
    </>
  )
}

interface SeatProps {
  readonly id: string
  readonly name: string
  readonly host?: boolean
  readonly surface: string
  /** The member arrives in front of the visitor: the join plays on the seat. */
  readonly arriving: boolean
}

/**
 * A member's avatar with the mint ring of presence, held still (no halo loop). An arriving member shows
 * under the mint disc in one step, never with a fade or a scale, so the initials never move.
 */
export function Seat({ id, name, host = false, surface, arriving }: SeatProps) {
  return (
    <span className="relative block shrink-0">
      <span
        className={cn(
          'ring-mint block rounded-full ring-2',
          arriving && 'motion-safe:animate-seat-in'
        )}
      >
        <Avatar size={28} playerId={id} name={name} host={host} surface={surface} />
      </span>
      {arriving && <JoinFlash />}
    </span>
  )
}
