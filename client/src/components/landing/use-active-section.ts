'use client'

import { useEffect, useState } from 'react'

/**
 * The band of the viewport that decides which section the reader is in: a thin line a little above the
 * middle, so a section counts once its top has crossed the middle of the screen.
 */
const READING_BAND = '-45% 0px -50% 0px'

/**
 * The id, among `ids`, of the section the reader is in, or `null` before any section is reached. It
 * follows the page with an `IntersectionObserver`, not a scroll listener. The first section in `ids`
 * order wins when two cross the band at once, and an id with no element on the page is skipped.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    const crossing = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) crossing.add(entry.target.id)
          else crossing.delete(entry.target.id)
        }
        setActive(ids.find((id) => crossing.has(id)) ?? null)
      },
      { rootMargin: READING_BAND }
    )
    for (const id of ids) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }

    return () => {
      observer.disconnect()
    }
  }, [ids])

  return active
}
