'use client'

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { prefersReducedMotion, useReducedMotion } from '@/hooks/use-reduced-motion'
import { DEMO_FOUNDERS, DEMO_TOTAL } from './hero-demo-data'

/** Once the stage is visible, the first slot locks in after this long, then one every step. */
const DEMO_START_DELAY_MS = 600
const DEMO_STEP_MS = 900
/** How much of the stage must be on screen before the story starts, so the viewer sees it from its start. */
const DEMO_VISIBLE_SHARE = 0.5

export interface HeroDemoState {
  /** Slots locked in: the members of the squad. */
  readonly filled: number
  /** The script is driving the demo, so slots that lock in from now on enter with their motion. */
  readonly scripted: boolean
  /** The demo was just rewound: its transitions are off for that one change. */
  readonly instant: boolean
}

export interface HeroDemo extends HeroDemoState {
  /** Plays the story again from its start, as the viewer asked for it; reduced motion keeps it full. */
  readonly replay: () => void
}

/** What the server HTML shows, what hydration renders, and what reduced motion keeps: the squad full. */
const FINAL_STATE: HeroDemoState = { filled: DEMO_TOTAL, scripted: false, instant: false }

const REWOUND_STATE: HeroDemoState = { filled: DEMO_FOUNDERS, scripted: true, instant: true }

/**
 * The hero demo's script. The first render, on the server and in hydration, is the final state, so both
 * agree and nothing flashes in an empty one. Once mounted, and only when motion is allowed, the demo
 * rewinds to its start before it paints, waits until `target` (the slot stage) is visible, and plays
 * once: a slot locks in every step. It never loops on its own; `replay` plays it again when the viewer
 * asks. Under reduced motion it never rewinds.
 */
export function useHeroDemo(target: RefObject<Element | null>): HeroDemo {
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<HeroDemoState>(FINAL_STATE)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const observer = useRef<IntersectionObserver | null>(null)

  const cancel = useCallback(() => {
    observer.current?.disconnect()
    for (const timer of timers.current) clearTimeout(timer)
    timers.current.clear()
  }, [])

  const play = useCallback(() => {
    for (let step = 0; step < DEMO_TOTAL - DEMO_FOUNDERS; step++) {
      const filled = DEMO_FOUNDERS + step + 1
      const timer = setTimeout(
        () => {
          timers.current.delete(timer)
          setState({ filled, scripted: true, instant: false })
        },
        DEMO_START_DELAY_MS + step * DEMO_STEP_MS
      )
      timers.current.add(timer)
    }
  }, [])

  useLayoutEffect(() => {
    const element = target.current
    // In hydration the hook still answers with the server's `false`; the browser knows better.
    if (reducedMotion || prefersReducedMotion() || !element) {
      setState(FINAL_STATE)
      return
    }

    setState(REWOUND_STATE)

    const visibility = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= DEMO_VISIBLE_SHARE
        )
        if (!seen) return
        visibility.disconnect()
        play()
      },
      { threshold: DEMO_VISIBLE_SHARE }
    )
    visibility.observe(element)
    observer.current = visibility

    return cancel
  }, [reducedMotion, target, play, cancel])

  const replay = useCallback(() => {
    cancel()
    if (prefersReducedMotion()) {
      setState(FINAL_STATE)
      return
    }
    // The viewer is looking at the stage: the control that asks for the replay sits on it.
    setState(REWOUND_STATE)
    play()
  }, [cancel, play])

  return { ...state, replay }
}
