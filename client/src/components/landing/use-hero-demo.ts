'use client'

import { useLayoutEffect, useState, type RefObject } from 'react'
import { prefersReducedMotion, useReducedMotion } from '@/hooks/use-reduced-motion'

/** The squad the demo fills up, and how many members it starts with (reference, Motion: Hero). */
export const DEMO_TOTAL = 5
const DEMO_START_FILLED = 2

/** Once the card is visible, the first member joins after this long, then one every step. */
const DEMO_START_DELAY_MS = 600
const DEMO_STEP_MS = 900
/** A joined member's toast stays this long before it leaves. */
const DEMO_TOAST_MS = 1600

export interface HeroDemoState {
  /** Members in the squad. */
  readonly filled: number
  /** The counts the visible toasts announce, in the order they came in. */
  readonly toasts: readonly number[]
  /** The script is driving the card, so members that join enter with their animation. */
  readonly scripted: boolean
  /** The card was just rewound: its transitions are off for that one change. */
  readonly instant: boolean
}

/** What the server HTML shows, what hydration renders, and what reduced motion keeps: the squad full. */
const FINAL_STATE: HeroDemoState = {
  filled: DEMO_TOTAL,
  toasts: [],
  scripted: false,
  instant: false,
}

const REWOUND_STATE: HeroDemoState = {
  filled: DEMO_START_FILLED,
  toasts: [],
  scripted: true,
  instant: true,
}

/**
 * The hero demo's one-shot script. The first render, on the server and in hydration, is the final
 * state, so both agree and nothing flashes in an empty one. Once mounted, and only when motion is
 * allowed, the card rewinds to its start before it paints, waits until `target` is visible, and
 * plays once: a member every step, each with a toast that leaves on its own. It never loops and never
 * replays. Under reduced motion it never rewinds.
 */
export function useHeroDemo(target: RefObject<Element | null>): HeroDemoState {
  const reducedMotion = useReducedMotion()
  const [state, setState] = useState<HeroDemoState>(FINAL_STATE)

  useLayoutEffect(() => {
    const element = target.current
    // In hydration the hook still answers with the server's `false`; the browser knows better.
    if (reducedMotion || prefersReducedMotion() || !element) {
      setState(FINAL_STATE)
      return
    }

    setState(REWOUND_STATE)

    const timers = new Set<ReturnType<typeof setTimeout>>()
    const later = (run: () => void, delay: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        run()
      }, delay)
      timers.add(timer)
    }

    const play = () => {
      for (let step = 0; step < DEMO_TOTAL - DEMO_START_FILLED; step++) {
        const filled = DEMO_START_FILLED + step + 1
        later(
          () => {
            setState((current) => ({
              filled,
              toasts: [...current.toasts, filled],
              scripted: true,
              instant: false,
            }))
          },
          DEMO_START_DELAY_MS + step * DEMO_STEP_MS
        )
        later(
          () => {
            setState((current) => ({
              ...current,
              toasts: current.toasts.filter((count) => count !== filled),
            }))
          },
          DEMO_START_DELAY_MS + step * DEMO_STEP_MS + DEMO_TOAST_MS
        )
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      play()
    })
    observer.observe(element)

    return () => {
      observer.disconnect()
      for (const timer of timers) clearTimeout(timer)
    }
  }, [reducedMotion, target])

  return state
}
