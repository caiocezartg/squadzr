import type { ReactNode } from 'react'
import { LazyMotion } from 'motion/react'

/**
 * The animation features load after the first render, so the initial JavaScript only carries the
 * `m` components. `domAnimation` covers the animations the app plays: `initial`, `animate` and
 * `whileInView` with its `viewport` option.
 */
function loadMotionFeatures() {
  return import('motion/react').then((module) => module.domAnimation)
}

/**
 * Gives every `m` component below it the animation features. `strict` makes rendering a full
 * `motion` component throw, so the whole library cannot quietly come back into the bundle.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadMotionFeatures} strict>
      {children}
    </LazyMotion>
  )
}
