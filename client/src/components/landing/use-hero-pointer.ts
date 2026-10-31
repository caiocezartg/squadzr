'use client'

import { useEffect, type RefObject } from 'react'

/** Decorative pointer effects need a mouse that hovers, and a viewer who did not ask for less motion. */
const POINTER_QUERY =
  '(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

/** How far the backdrop drifts against the pointer, at the hero's edges. */
const BACKDROP_SHIFT_X = 18
const BACKDROP_SHIFT_Y = 12
/** The steepest a slot leans toward the pointer, either way. */
const TILT_MAX_DEG = 7

/** Where the pointer is over `rect`, from -1 to 1 on each axis, clamped at its edges. */
function relative(
  rect: DOMRect,
  x: number,
  y: number
): { readonly nx: number; readonly ny: number } {
  const clamp = (value: number) => Math.max(-1, Math.min(1, value))
  return {
    nx: clamp(((x - rect.left) / rect.width) * 2 - 1),
    ny: clamp(((y - rect.top) / rect.height) * 2 - 1),
  }
}

/** A slot's resting box: its frame's, which never tilts, so the lean does not feed back into itself. */
function restingRect(slot: HTMLElement): DOMRect {
  return (slot.parentElement ?? slot).getBoundingClientRect()
}

function tiltSlot(slot: HTMLElement, rect: DOMRect, x: number, y: number): void {
  const { nx, ny } = relative(rect, x, y)
  slot.style.transform = `rotateX(${(-ny * TILT_MAX_DEG).toFixed(2)}deg) rotateY(${(nx * TILT_MAX_DEG).toFixed(2)}deg) translateZ(0)`
  const glare = slot.querySelector<HTMLElement>('[data-glare]')
  if (glare) glare.style.transform = `translate(${(nx * 50).toFixed(1)}%, ${(ny * 50).toFixed(1)}%)`
}

function restSlot(slot: HTMLElement): void {
  slot.style.transform = ''
  const glare = slot.querySelector<HTMLElement>('[data-glare]')
  if (glare) glare.style.transform = ''
}

/**
 * The hero's response to the pointer. The backdrop (`[data-parallax]`) drifts a little against the
 * pointer anywhere over `root`, and the slot under it (`[data-tilt]`) leans toward it, with its glare
 * (`[data-glare]`) following. Only `transform` changes, once per frame at most, and the elements' own
 * CSS transitions smooth the steps. Touch screens and reduced motion get none of it: the effects are
 * decoration, and every action they sit on works without them.
 */
export function useHeroPointer(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = root.current
    if (!element) return
    const query = window.matchMedia(POINTER_QUERY)

    let frame = 0
    let pointer: { readonly x: number; readonly y: number } | null = null

    const render = () => {
      frame = 0
      const backdrop = element.querySelector<HTMLElement>('[data-parallax]')
      const slots = element.querySelectorAll<HTMLElement>('[data-tilt]')
      if (!pointer) {
        if (backdrop) backdrop.style.transform = ''
        slots.forEach(restSlot)
        return
      }
      const { x, y } = pointer
      if (backdrop) {
        const { nx, ny } = relative(element.getBoundingClientRect(), x, y)
        backdrop.style.transform = `translate3d(${(-nx * BACKDROP_SHIFT_X).toFixed(1)}px, ${(-ny * BACKDROP_SHIFT_Y).toFixed(1)}px, 0)`
      }
      for (const slot of slots) {
        const rect = restingRect(slot)
        const over = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        if (over) tiltSlot(slot, rect, x, y)
        else restSlot(slot)
      }
    }

    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(render)
    }

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !query.matches) return
      pointer = { x: event.clientX, y: event.clientY }
      schedule()
    }

    const handleLeave = () => {
      pointer = null
      schedule()
    }

    element.addEventListener('pointermove', handleMove)
    element.addEventListener('pointerleave', handleLeave)
    query.addEventListener('change', handleLeave)

    return () => {
      element.removeEventListener('pointermove', handleMove)
      element.removeEventListener('pointerleave', handleLeave)
      query.removeEventListener('change', handleLeave)
      cancelAnimationFrame(frame)
    }
  }, [root])
}
