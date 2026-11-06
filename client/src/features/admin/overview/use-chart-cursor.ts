'use client'

import { useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from 'react'

const KEY_MOVES: Record<string, (index: number, last: number) => number> = {
  ArrowRight: (index, last) => Math.min(last, index + 1),
  ArrowLeft: (index) => Math.max(0, index - 1),
  Home: () => 0,
  End: (_, last) => last,
}

/**
 * The day the chart's crosshair stands on, or `null` when it is hidden. A mouse moves it and hides it on
 * leaving; a touch places it where the finger is and keeps it after lifting; keyboard focus places it on
 * the latest day, the arrow keys, Home and End move it, and losing focus hides it.
 */
export function useChartCursor(count: number) {
  const [index, setIndex] = useState<number | null>(null)
  const last = count - 1
  const active = index === null ? null : Math.min(index, last)

  const fromPointer = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0 || count === 0) return
    const ratio = (event.clientX - box.left) / box.width
    setIndex(Math.max(0, Math.min(last, Math.round(ratio * last))))
  }

  return {
    active,
    handlers: {
      onPointerMove: fromPointer,
      onPointerDown: fromPointer,
      onPointerLeave: (event: PointerEvent<HTMLElement>) => {
        if (event.pointerType === 'mouse') setIndex(null)
      },
      onFocus: (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget && count > 0)
          setIndex((current) => current ?? last)
      },
      onBlur: () => setIndex(null),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const move = KEY_MOVES[event.key]
        if (!move || count === 0) return
        event.preventDefault()
        setIndex((current) => move(current ?? last, last))
      },
    },
  }
}
