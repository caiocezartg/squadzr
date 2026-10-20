'use client'

import type { ReactNode } from 'react'
import { domAnimation, LazyMotion } from 'motion/react'

/**
 * The animation features for a dialog that opens on demand. The dialog's chunk carries them, so its card
 * animates from its first frame. The route shell loads the features after its first render instead
 * (`MotionProvider`), which the initial JavaScript of a route cannot afford for a dialog nobody opened yet.
 */
export function DialogMotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
