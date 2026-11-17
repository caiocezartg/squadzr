/**
 * The hero's clock: the players take off after the second line starts to rise, land one step apart,
 * and the counter rolls one step per landing, so it reaches the full squad as the last player lands.
 */

import type { CSSProperties } from 'react'
import { describe, expect, it } from 'vitest'
import { HERO_TIMELINE, heroClock, squadmateTiming } from './hero-timeline'

function millis(style: CSSProperties, property: `--${string}`): number {
  const value = (style as Record<string, string>)[property]
  if (!value?.endsWith('ms')) throw new Error(`${property} is not in milliseconds: ${value}`)
  return Number(value.slice(0, -2))
}

describe('the hero timeline', () => {
  it('lands the players one step apart, each taking off after the second line starts to rise', () => {
    const landings = [0, 1, 2, 3].map((index) => millis(squadmateTiming(index), '--land-at'))
    const takeOffs = [0, 1, 2, 3].map((index) => millis(squadmateTiming(index), '--fly-at'))

    for (const takeOff of takeOffs) expect(takeOff).toBeGreaterThan(HERO_TIMELINE.formedAt)
    expect(landings.slice(1).map((landing, index) => landing - (landings[index] ?? 0))).toEqual([
      HERO_TIMELINE.flyStep,
      HERO_TIMELINE.flyStep,
      HERO_TIMELINE.flyStep,
    ])
  })

  it('rolls the counter one step per landing, ending as the last player lands', () => {
    const clock = heroClock(4)
    const lastLanding = millis(squadmateTiming(3), '--land-at')

    expect(millis(clock, '--hero-count-at') + millis(clock, '--hero-count-for')).toBe(lastLanding)
    expect(millis(clock, '--hero-last-land-at')).toBe(lastLanding)
  })

  it('lets each player bob only until it takes off, so it leaves from rest', () => {
    for (const index of [0, 1, 2, 3]) {
      const timing = squadmateTiming(index)
      expect(millis(timing, '--bob-for')).toBe(millis(timing, '--fly-at'))
    }
  })
})
