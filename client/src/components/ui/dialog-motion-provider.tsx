'use client'

import type { ReactNode } from 'react'
import { domAnimation, LazyMotion } from 'motion/react'

/**
 * The animation features for a dialog that renders inside a route. The dialog is imported with its page
 * (since CCC-81), so this provider ships with it and its card animates from the first frame on the App
 * Router, where the route has no `LazyMotion` ancestor.
 */
export function DialogMotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
