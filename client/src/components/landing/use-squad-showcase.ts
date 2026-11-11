'use client'

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react'
import { prefersReducedMotion, useReducedMotion } from '@/hooks/use-reduced-motion'
import { SHOWCASE_SQUADS, squadSize } from './hero-showcase-data'

/** Once a squad reaches the centre, its first player joins after this long, then one every step. */
export const SHOWCASE_START_MS = 900
export const SHOWCASE_JOIN_MS = 800
/** How long a full squad holds the centre before the next one slides in. */
export const SHOWCASE_HOLD_MS = 2200
/** How much of the carousel must be on screen before it starts, so the viewer sees it from its start. */
const SHOWCASE_VISIBLE_SHARE = 0.4

export interface ShowcaseState {
  /** The squad in the centre, as an index of `SHOWCASE_SQUADS`. */
  readonly active: number
  /** How many members the centre squad has. */
  readonly filled: number
  /** The script is driving the carousel, so members who join from now on enter with their motion. */
  readonly scripted: boolean
}

export interface SquadShowcase extends ShowcaseState {
  /** The carousel moves on its own: motion is allowed, it is on screen and the viewer has not paused it. */
  readonly playing: boolean
  /** The viewer stopped it with the pause control. */
  readonly paused: boolean
  /** Whether it can move at all: under reduced motion it never does, and offers no pause. */
  readonly animated: boolean
  readonly togglePause: () => void
  /** Holds it while the pointer or the focus is on it, without counting as the viewer's pause. */
  readonly setHeld: (held: boolean) => void
  /** Brings squad `index` to the centre: from its start, or full under reduced motion. */
  readonly goTo: (index: number) => void
}

function squadAt(index: number) {
  const squad = SHOWCASE_SQUADS[index]
  if (!squad) throw new Error(`No showcase squad at ${index}`)
  return squad
}

/** What the server HTML shows, what hydration renders, and what reduced motion keeps: the first squad, full. */
const FINAL_STATE: ShowcaseState = { active: 0, filled: squadSize(squadAt(0)), scripted: false }

function startOf(index: number): ShowcaseState {
  return { active: index, filled: squadAt(index).founders, scripted: true }
}

/** The step after `state`: one more member, or, once the squad is full, the next squad from its start. */
function nextState(state: ShowcaseState): ShowcaseState {
  if (state.filled < squadSize(squadAt(state.active))) {
    return { ...state, filled: state.filled + 1, scripted: true }
  }
  return startOf((state.active + 1) % SHOWCASE_SQUADS.length)
}

/** How long `state` lasts before `nextState`. */
function stepDelay(state: ShowcaseState): number {
  const squad = squadAt(state.active)
  if (state.filled >= squadSize(squad)) return SHOWCASE_HOLD_MS
  return state.filled === squad.founders ? SHOWCASE_START_MS : SHOWCASE_JOIN_MS
}

/**
 * The hero carousel's script. The first render, on the server and in hydration, is the final state, so
 * both agree and the server HTML shows a full squad. Once mounted, and only when motion is allowed, it
 * rewinds the first squad to its start before it paints, waits until `target` is on screen, and then runs:
 * members join the centre squad one by one, the full squad holds, and the next one slides in, around and
 * around. The pause control stops it for good, and the pointer or the focus on it holds it for as long as
 * they stay. Under reduced motion it never moves; the viewer can still bring any squad to the centre.
 */
export function useSquadShowcase(target: RefObject<Element | null>): SquadShowcase {
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<ShowcaseState>(FINAL_STATE)
  const [seen, setSeen] = useState(false)
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(false)
  const animated = !reducedMotion
  const playing = animated && seen && !paused && !held

  useLayoutEffect(() => {
    const element = target.current
    // In hydration the hook still answers with the server's `false`; the browser knows better.
    if (reducedMotion || prefersReducedMotion() || !element) {
      setState((current) => ({
        active: current.active,
        filled: squadSize(squadAt(current.active)),
        scripted: false,
      }))
      return
    }

    setState((current) => (current === FINAL_STATE ? startOf(0) : current))

    const visibility = new IntersectionObserver(
      (entries) => {
        const visible = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= SHOWCASE_VISIBLE_SHARE
        )
        setSeen(visible)
      },
      { threshold: [0, SHOWCASE_VISIBLE_SHARE] }
    )
    visibility.observe(element)
    return () => visibility.disconnect()
  }, [reducedMotion, target])

  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setState(nextState), stepDelay(state))
    return () => clearTimeout(timer)
  }, [playing, state])

  const goTo = useCallback((index: number) => {
    if (prefersReducedMotion()) {
      setState({ active: index, filled: squadSize(squadAt(index)), scripted: false })
      return
    }
    setState(startOf(index))
  }, [])

  const togglePause = useCallback(() => setPaused((current) => !current), [])

  return { ...state, playing, paused, animated, togglePause, setHeld, goTo }
}
