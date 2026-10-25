'use client'

import { createElement, useEffect, useRef, useState, type ComponentPropsWithoutRef } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'

/** The share of the element that must enter the viewport (reference, Landing sections). */
const REVEAL_THRESHOLD = 0.15

/**
 * `idle`: rendered as is, which is how the server HTML and any content already in view stay.
 * `hidden`: out of sight below the viewport, waiting to enter. `shown`: entered, plays the reveal.
 */
type RevealPhase = 'idle' | 'hidden' | 'shown'

type RevealProps = ComponentPropsWithoutRef<'div'> & {
  readonly as?: 'div' | 'section' | 'article' | 'header' | 'ul' | 'ol'
  /** Reveals the direct children one after another, 50ms apart, instead of the element as one. */
  readonly stagger?: boolean
}

function isBelowViewport(element: Element): boolean {
  return element.getBoundingClientRect().top >= window.innerHeight
}

/**
 * Fades its content in with a 16px rise once, when 15% of it enters the viewport. The motion itself
 * is CSS (`[data-reveal]` in the global styles).
 *
 * Content that is in view or above it when the page mounts never animates: only an element still
 * below the viewport is hidden, and it is out of sight when that happens. Under reduced motion the
 * content renders in its final state and nothing is hidden.
 */
export function Reveal({ as = 'div', stagger = false, children, ...props }: RevealProps) {
  const ref = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<RevealPhase>('idle')

  useEffect(() => {
    const element = ref.current
    if (!element || !isBelowViewport(element)) return

    setPhase('hidden')
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setPhase('shown')
        observer.disconnect()
      },
      { threshold: REVEAL_THRESHOLD }
    )
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [])

  return createElement(
    as,
    {
      ...props,
      ref,
      'data-reveal': reducedMotion || phase === 'idle' ? undefined : phase,
      'data-reveal-stagger': stagger ? '' : undefined,
    },
    children
  )
}
