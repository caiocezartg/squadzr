import { useLayoutEffect, useRef, useState } from 'react'
import type { ViewerSeatMode } from './viewer-first-rail'

/** How much of a circle the next one covers: the rail's `-ml-1.5`. */
const OVERLAP_PX = 6
/** What the `+N` label needs next to the circles: its margin and up to three digits. */
const EXTRA_LABEL_PX = 44

export interface RailFit {
  /** The width the circles can use. */
  readonly width: number
  readonly circleWidth: number
  /** The viewer's seat's width once open; 0 without one. */
  readonly viewerWidth: number
  readonly seat: ViewerSeatMode
  /** The regular circles the rail would draw. */
  readonly total: number
  /** Seats past the rail already need a `+N`. */
  readonly hasExtra: boolean
}

/** The width the viewer's seat takes from the regular circles at its widest. */
function viewerReserve({ seat, viewerWidth, circleWidth }: RailFit): number {
  // The seat leaves 6px after itself, which the next circle's overlap takes back.
  if (seat === 'seated') return viewerWidth
  if (seat === 'on-hover') return Math.max(0, viewerWidth - (circleWidth - OVERLAP_PX))
  return 0
}

/**
 * How many regular circles fit whole, with room for the `+N` label whenever some seats go uncounted
 * on the rail, and never fewer than one.
 */
export function circlesThatFit(fit: RailFit): number {
  const { width, circleWidth, total, hasExtra } = fit
  const circlesIn = (room: number) =>
    Math.floor((room - circleWidth) / (circleWidth - OVERLAP_PX)) + 1
  const room = width - viewerReserve(fit)
  const needsLabel = hasExtra || circlesIn(room) < total
  return Math.min(total, Math.max(1, circlesIn(room - (needsLabel ? EXTRA_LABEL_PX : 0))))
}

function horizontalPadding(element: HTMLElement): number {
  const style = getComputedStyle(element)
  return (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
}

/**
 * How many of the rail's regular circles fit in the width the rail has, so a narrow card shows whole
 * circles and folds the rest into `+N`, and never clips one. The rail element must fill the room it has
 * (`flex-1`), not shrink to its content, and hold `[data-rail-circle]` children; the viewer's seat is
 * measured from `[data-rail-viewer-face]`, which keeps its size while the seat is folded. Until the
 * width is known (the server render, a layout with no width) every circle is shown.
 */
export function useFittingCircles(total: number, hasExtra: boolean, seat: ViewerSeatMode) {
  const railRef = useRef<HTMLSpanElement>(null)
  const [fitting, setFitting] = useState<number | null>(null)

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const measure = () => {
      const circleWidth = rail.querySelector<HTMLElement>('[data-rail-circle]')?.offsetWidth ?? 0
      const width = rail.clientWidth - horizontalPadding(rail)
      if (!circleWidth || width <= 0) return

      const viewerWidth =
        seat === 'none'
          ? 0
          : (rail.querySelector<HTMLElement>('[data-rail-viewer-face]')?.offsetWidth ?? 0)
      setFitting(circlesThatFit({ width, circleWidth, viewerWidth, seat, total, hasExtra }))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [total, hasExtra, seat])

  return { railRef, shown: fitting === null ? total : Math.min(fitting, total) }
}
