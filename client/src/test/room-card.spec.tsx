/**
 * Regression tests for the RoomCard entrance (CCC-40 r4–r6).
 *
 * Three properties are load-bearing:
 *
 * - the CSS transition on the card must not include `opacity`, or it replays
 *   the entrance fade;
 * - the entrance fade never leaves an inline opacity behind: it is a WAAPI
 *   animation from 0 that ends on the element's own opacity and only fills
 *   backwards. An inline `opacity: 0` committed after the animation (what
 *   motion did) paints one frame of an invisible card when the fade ends;
 * - the card never waits for the network: the cover starts hidden over the
 *   placeholder and fades in on its own once it loads, and stays hidden if it
 *   fails.
 *
 * jsdom has no `Element.animate` or `matchMedia`, so both are installed per
 * test and the fade is asserted through the recorded calls.
 */

import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomCard } from '@/components/rooms/room-card'
import type { Game } from '@/types'
import { gameLol, openRoom } from './fixtures'

type AnimateCall = {
  element: Element
  keyframes: unknown
  options: unknown
  cancel: ReturnType<typeof vi.fn>
}

let animateCalls: AnimateCall[] = []
let prefersReducedMotion = false

beforeEach(() => {
  animateCalls = []
  prefersReducedMotion = false
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function animate(this: Element, keyframes: unknown, options: unknown) {
      const cancel = vi.fn()
      animateCalls.push({ element: this, keyframes, options, cancel })
      return { cancel } as unknown as Animation
    },
  })
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: prefersReducedMotion && query.includes('reduce'),
        media: query,
      }) as MediaQueryList,
  })
})

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'animate')
  Reflect.deleteProperty(window, 'matchMedia')
})

function cardFades(card: HTMLElement) {
  return animateCalls.filter((call) => call.element === card)
}

describe('room card — entrance animation', () => {
  it('keeps opacity out of the CSS transition properties', () => {
    render(<RoomCard room={openRoom} game={gameLol} />)

    const card = screen.getByRole('button')
    expect(card.className).not.toMatch(/(^|\s)transition-all(\s|$)/)

    const transitionProperty = card.className.match(/(?:^|\s)transition-\[([^\]]+)\]/)
    expect(transitionProperty).not.toBeNull()

    const properties = transitionProperty?.[1]?.split(',').map((property) => property.trim())
    expect(properties).toEqual(
      expect.arrayContaining(['transform', 'border-color', 'box-shadow', 'filter'])
    )
    expect(properties).not.toContain('opacity')
  })

  it('fades in from 0 to its own opacity without leaving an inline opacity behind', () => {
    render(<RoomCard room={openRoom} game={gameLol} />)

    const card = screen.getByRole('button')
    // No inline value means the end of the fade lands on the stylesheet
    // opacity, so no frame can fall back to an inline 0.
    expect(card.style.opacity).toBe('')
    const fades = cardFades(card)
    expect(fades).toHaveLength(1)
    expect(fades[0]?.keyframes).toEqual([{ opacity: 0, offset: 0 }])
    expect(fades[0]?.options).toMatchObject({ duration: 500, fill: 'backwards' })
  })

  it('starts the fade on mount and stays visible without waiting for the cover', () => {
    vi.useFakeTimers()
    try {
      render(<RoomCard room={openRoom} game={gameLol} />)
      vi.advanceTimersByTime(2_000)

      const card = screen.getByRole('button')
      expect(card.style.opacity).toBe('')
      expect(getComputedStyle(card).opacity).not.toBe('0')
      expect(cardFades(card)).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('cancels the fade on unmount, including the StrictMode remount', () => {
    const { unmount } = render(
      <StrictMode>
        <RoomCard room={openRoom} game={gameLol} />
      </StrictMode>
    )
    const fades = cardFades(screen.getByRole('button'))
    expect(fades.length).toBeGreaterThan(0)

    unmount()

    for (const fade of fades) expect(fade.cancel).toHaveBeenCalledTimes(1)
  })

  it('skips the fade when the user prefers reduced motion', () => {
    prefersReducedMotion = true
    render(<RoomCard room={openRoom} game={gameLol} />)

    expect(animateCalls).toHaveLength(0)
    expect(screen.getByRole('button').style.opacity).toBe('')
  })

  it('fades in without a game cover', () => {
    render(<RoomCard room={openRoom} game={undefined} />)

    const card = screen.getByRole('button')
    expect(screen.queryByRole('img')).toBeNull()
    expect(card.style.opacity).toBe('')
    expect(cardFades(card)).toHaveLength(1)
  })
})

describe('room card — cover', () => {
  it('keeps the cover hidden over the placeholder until it loads, then fades it in', () => {
    render(<RoomCard room={openRoom} game={gameLol} />)

    const cover = screen.getByRole('img')
    expect(cover).toHaveClass('transition-opacity', 'opacity-0')
    expect(cover).not.toHaveClass('opacity-100')
    expect(cover.parentElement).toHaveClass('bg-surface-light')

    fireEvent.load(cover)

    expect(cover).toHaveClass('transition-opacity', 'opacity-100')
    expect(cover).not.toHaveClass('opacity-0')
  })

  it('keeps a broken cover hidden so the placeholder shows instead', () => {
    render(<RoomCard room={openRoom} game={gameLol} />)

    const cover = screen.getByRole('img')
    fireEvent.error(cover)

    expect(cover).toHaveClass('opacity-0')
    expect(screen.getByRole('button').style.opacity).toBe('')
  })

  it('hides the cover again while a new cover URL loads', () => {
    const { rerender } = render(<RoomCard room={openRoom} game={gameLol} />)
    fireEvent.load(screen.getByRole('img'))

    const otherGame: Game = { ...gameLol, coverUrl: 'https://cdn.squadzr.test/covers/other.jpg' }
    rerender(<RoomCard room={openRoom} game={otherGame} />)

    const cover = screen.getByRole('img')
    expect(cover).toHaveClass('opacity-0')
    fireEvent.load(cover)
    expect(cover).toHaveClass('opacity-100')
  })
})
