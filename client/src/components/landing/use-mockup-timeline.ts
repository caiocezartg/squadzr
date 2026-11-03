'use client'

import { useEffect, useState } from 'react'

/**
 * How a "Como funciona" mockup shows.
 * - `final`: its last beat, at once. The stacked cards and reduced motion use it, and the server HTML
 *   draws the cards with it.
 * - `waiting`: its first beat, until its step is active on screen.
 * - `play`: runs its beats once, then holds the last.
 */
export type MockupMode = 'final' | 'waiting' | 'play'

export interface MockupTimeline {
  /** The beat the mockup is at: 0 before it plays, `cues.length` once it has played. */
  readonly beat: number
  /**
   * The beats are playing in front of the visitor. One-shot effects (a member's join burst, the invite's
   * sheen) run only then, so a mockup that is drawn at its last beat never animates in.
   */
  readonly live: boolean
}

/**
 * A mockup's script: `cues` are the times, in milliseconds after it starts playing, at which each next
 * beat begins. The beats only ever move forward. A mockup that mounts already playing, because its stage
 * mounted again (the window crossed 1024px), starts at its last beat and never plays twice.
 */
export function useMockupTimeline(cues: readonly number[], mode: MockupMode): MockupTimeline {
  const last = cues.length
  const [startsWaiting] = useState(mode === 'waiting')
  const [beat, setBeat] = useState(startsWaiting ? 0 : last)
  const live = startsWaiting && mode === 'play'

  useEffect(() => {
    if (!live) return
    const timers = cues.map((at, index) =>
      window.setTimeout(() => setBeat((current) => Math.max(current, index + 1)), at)
    )
    return () => {
      for (const timer of timers) window.clearTimeout(timer)
    }
  }, [cues, live])

  return { beat, live }
}
