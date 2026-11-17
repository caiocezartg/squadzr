import type { CSSProperties } from 'react'

/**
 * The hero's story, in milliseconds from the moment it mounts (docs/design/reference.md, Hero). The
 * hero writes these as custom properties, and the hero animations in the global styles read them as
 * their delays, so the whole story plays on CSS from the first paint of the server HTML.
 */
export const HERO_TIMELINE = {
  /** The strike draws through SOLO, whose letters settle as it does. */
  strikeAt: 3100,
  /** The second line rises, the chips leave, and the squadmates start for their seats. */
  formedAt: 3580,
  /** The first chip rises in; each next one follows a step later, in its rank. */
  chipFirstAt: 250,
  chipStep: 230,
  /** The chips blur away from `formedAt`, each a step after the one before. */
  chipLeaveStep: 45,
  chipLeaveMs: 420,
  /** The squadmates fade in where they float, each a step after the one before. */
  appearFirstAt: 120,
  appearStep: 80,
  /** After `formedAt`, the first squadmate takes off; each next one a step later. */
  flyDelay: 220,
  flyStep: 110,
  flyMs: 1000,
} as const

const {
  strikeAt,
  formedAt,
  chipFirstAt,
  chipStep,
  chipLeaveStep,
  chipLeaveMs,
  appearFirstAt,
  appearStep,
  flyDelay,
  flyStep,
  flyMs,
} = HERO_TIMELINE

type CustomProperties = Record<`--${string}`, string>

const ms = (value: number) => `${value}ms`

/** When squadmate `index` takes off, and when it lands in its seat. */
function flight(index: number) {
  const takeOff = formedAt + flyDelay + index * flyStep
  return { takeOff, landing: takeOff + flyMs }
}

/**
 * The moments the hero's root carries: the strike, the second line, and the counter, which rolls one
 * step per landing, starting a landing early so each step ends as a player lands.
 */
export function heroClock(squadmates: number): CSSProperties {
  const first = flight(0).landing
  const last = flight(squadmates - 1).landing
  const properties: CustomProperties = {
    '--hero-strike-at': ms(strikeAt),
    '--hero-formed-at': ms(formedAt),
    '--hero-count-at': ms(first - flyStep),
    '--hero-count-for': ms(squadmates * flyStep),
    '--hero-last-land-at': ms(last),
  }
  return properties as CSSProperties
}

/** A chip of the solo life: it rises in by its rank, bobs, and blurs away by its place in the list. */
export function chipTiming(rank: number, index: number): CSSProperties {
  const leaveAt = formedAt + index * chipLeaveStep
  const properties: CustomProperties = {
    '--chip-in-at': ms(chipFirstAt + rank * chipStep),
    '--chip-out-at': ms(leaveAt),
    '--bob-for': ms(leaveAt + chipLeaveMs),
  }
  return properties as CSSProperties
}

/**
 * Squadmate `index`: it fades in where it floats, bobs once until it takes off (so it leaves from rest),
 * drops its name as it takes off, and its seat flashes its ring as it lands.
 */
export function squadmateTiming(index: number): CSSProperties {
  const { takeOff, landing } = flight(index)
  const properties: CustomProperties = {
    '--appear-at': ms(appearFirstAt + index * appearStep),
    '--bob-for': ms(takeOff),
    '--fly-at': ms(takeOff),
    '--label-out-at': ms(takeOff),
    '--land-at': ms(landing),
  }
  return properties as CSSProperties
}

/** The visitor's own seat: its "you" label leaves as the second line rises. */
export function visitorTiming(): CSSProperties {
  const properties: CustomProperties = { '--label-out-at': ms(formedAt) }
  return properties as CSSProperties
}
