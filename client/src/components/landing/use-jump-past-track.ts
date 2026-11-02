'use client'

import { useEffect, useState, type RefObject } from 'react'

/** The longest a browser's smooth scroll takes over the glide's distance (about a viewport). */
const GLIDE_MAX_MS = 1_200

/** A plain left click, with nothing that would open the link elsewhere. */
function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

/** The in-page section a click on a `#id` link leads to, or `null` for any other click. */
function anchorTarget(event: MouseEvent): { href: string; target: HTMLElement } | null {
  if (!(event.target instanceof Element)) return null
  const link = event.target.closest<HTMLAnchorElement>('a[href^="#"]')
  const href = link?.getAttribute('href')
  if (!href || href.length < 2) return null
  const target = document.getElementById(decodeURIComponent(href.slice(1)))
  return target ? { href, target } : null
}

/** Where the page scrolls to for `target`, honouring its scroll margin. */
function scrollTopFor(target: HTMLElement): number {
  const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0
  return target.getBoundingClientRect().top + window.scrollY - margin
}

/**
 * Links to the landing's sections skip the pinned part of the "Como funciona" track when the way there
 * runs through it. The smooth scroll would otherwise run the stage's steps past the visitor in a blur.
 * The page jumps at once to the edge of the pinned part on the far side, where the stage is released,
 * and smooth-scrolls the rest of the way, so the visitor still glides into the section. The stage reads
 * no step from the jump, so no mockup plays on the way. Every other in-page link keeps the page's smooth
 * scroll, and so does a link to the track itself from above, whose stage is the destination.
 *
 * Returns whether a skip is under way: from the jump until the glide ends. The stage, glimpsed at its
 * edge on the way, does not play its first step then.
 */
export function useJumpPastTrack(track: RefObject<HTMLElement | null>): boolean {
  const [skipping, setSkipping] = useState(false)

  useEffect(() => {
    let settle: number | undefined
    let destination = 0
    const settled = () => {
      window.clearTimeout(settle)
      window.removeEventListener('scrollend', onScrollEnd)
      setSkipping(false)
    }
    // The instant jump ends a scroll of its own; only the end of the glide, at the section, settles.
    const onScrollEnd = () => {
      if (Math.abs(window.scrollY - destination) < 2) settled()
    }

    const onClick = (event: MouseEvent) => {
      const element = track.current
      if (!element || !isPlainClick(event)) return
      const anchor = anchorTarget(event)
      if (!anchor) return

      const from = window.scrollY
      const to = scrollTopFor(anchor.target)
      const trackTop = element.getBoundingClientRect().top + from
      // The scroll positions at which the stage is pinned and stepping.
      const pinnedFrom = trackTop
      const pinnedTo = trackTop + element.offsetHeight - window.innerHeight
      const crosses = Math.min(from, to) < pinnedTo && Math.max(from, to) > pinnedFrom
      if (!crosses) return

      event.preventDefault()
      window.history.pushState(null, '', anchor.href)
      const skipTo = to > from ? Math.max(from, pinnedTo) : Math.min(from, pinnedFrom)
      window.scrollTo({ top: skipTo, behavior: 'instant' })
      if (skipTo === to) return
      setSkipping(true)
      window.scrollTo({ top: to, behavior: 'smooth' })
      // The glide ends with `scrollend`; the timeout covers a browser without it.
      destination = to
      window.addEventListener('scrollend', onScrollEnd)
      window.clearTimeout(settle)
      settle = window.setTimeout(settled, GLIDE_MAX_MS)
    }

    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
      window.removeEventListener('scrollend', onScrollEnd)
      window.clearTimeout(settle)
    }
  }, [track])

  return skipping
}
