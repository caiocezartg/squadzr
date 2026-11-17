'use client'

import { useLayoutEffect, type RefObject } from 'react'
import { SQUADMATES, type HeroTier } from './hero-solo-data'

/** The hero's tiers, as the `md` and `xl` breakpoints draw them. */
const TABLET_QUERY = '(min-width: 48rem)'
const WIDE_QUERY = '(min-width: 80rem)'

function currentTier(): HeroTier {
  if (window.matchMedia(WIDE_QUERY).matches) return 'wide'
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet'
  return 'phone'
}

/**
 * Places each squadmate where the hero has them float before they fly in. A spot is given from the
 * headline's top centre, x as a share of its half width and y in its ems (see `Squadmate`); this turns
 * it into the offset from the player's own seat (`--fly-x`, `--fly-y`) that the fly-in starts from,
 * and marks the player placed, which is when it shows. It measures again whenever the headline resizes
 * and once the fonts load, since both move the headline and the seats. `squadmates` holds each
 * player's flyer, which sits in its seat.
 */
export function useSquadmateSpots(
  headline: RefObject<HTMLElement | null>,
  squadmates: RefObject<(HTMLElement | null)[]>
): void {
  useLayoutEffect(() => {
    const title = headline.current
    if (!title) return

    const place = () => {
      const box = title.getBoundingClientRect()
      const em = Number.parseFloat(getComputedStyle(title).fontSize)
      const tier = currentTier()

      squadmates.current.forEach((flyer, index) => {
        const seat = flyer?.parentElement
        const spot = SQUADMATES[index]?.spots[tier]
        if (!flyer || !seat || !spot) return
        const [x, y] = spot
        const seatBox = seat.getBoundingClientRect()
        const centre = box.left + box.width / 2
        const dx = centre + (x * box.width) / 2 - (seatBox.left + seatBox.width / 2)
        const dy = box.top + y * em - (seatBox.top + seatBox.height / 2)
        flyer.style.setProperty('--fly-x', `${dx.toFixed(1)}px`)
        flyer.style.setProperty('--fly-y', `${dy.toFixed(1)}px`)
        flyer.dataset.placed = ''
      })
    }

    place()
    const resize = new ResizeObserver(place)
    resize.observe(title)
    let live = true
    // jsdom has no font loading API.
    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        if (live) place()
      })
    }

    return () => {
      live = false
      resize.disconnect()
    }
  }, [headline, squadmates])
}
