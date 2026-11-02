'use client'

import { useEffect, type RefObject } from 'react'

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
 * Links to the landing's sections jump straight to them when the way there runs through the pinned
 * part of the "Como funciona" track. The smooth scroll would otherwise run the stage's steps past the
 * visitor in a blur. The jump is instant, and it lands past the track, so no mockup plays on the way.
 * Every other in-page link keeps the page's smooth scroll, and so does a link to the track itself from
 * above, whose stage is the destination.
 */
export function useJumpPastTrack(track: RefObject<HTMLElement | null>): void {
  useEffect(() => {
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
      window.scrollTo({ top: to, behavior: 'instant' })
    }

    document.addEventListener('click', onClick)
    return () => {
      document.removeEventListener('click', onClick)
    }
  }, [track])
}
