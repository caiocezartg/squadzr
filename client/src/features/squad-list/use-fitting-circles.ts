import { useLayoutEffect, useRef, useState } from 'react'

/** How much of a circle the next one covers: the rail's `-ml-1.5`. */
const OVERLAP_PX = 6
/** What the `+N` label needs next to the circles: its margin and up to three digits. */
const EXTRA_LABEL_PX = 44

/**
 * How many of the rail's circles fit in the width the rail has, so a narrow card shows whole circles
 * and folds the rest into `+N`, and never clips one. The rail element must fill the room it has
 * (`flex-1`), not shrink to its content, and hold `[data-rail-circle]` children. Until the width is
 * known (the server render, a layout with no width) every circle is shown.
 */
export function useFittingCircles(total: number, hasExtra: boolean) {
  const railRef = useRef<HTMLSpanElement>(null)
  const [fitting, setFitting] = useState<number | null>(null)

  useLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return

    const measure = () => {
      const size = rail.querySelector<HTMLElement>('[data-rail-circle]')?.offsetWidth ?? 0
      const width = rail.clientWidth
      if (!size || !width) return

      const circlesIn = (room: number) => Math.floor((room - size) / (size - OVERLAP_PX)) + 1
      const needsLabel = hasExtra || circlesIn(width) < total
      setFitting(Math.max(1, Math.min(total, circlesIn(width - (needsLabel ? EXTRA_LABEL_PX : 0)))))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(rail)
    return () => observer.disconnect()
  }, [total, hasExtra])

  return { railRef, shown: fitting === null ? total : Math.min(fitting, total) }
}
