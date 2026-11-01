/**
 * The hero carousel (CCC-115): the centre squad fills up one player at a time, holds once it is full and
 * gives the centre to the next squad, from its start. It starts once it is on screen, holds while the
 * pointer is on it and stops for good with its pause control; the bars bring any squad to the centre.
 * The server HTML shows the first squad full, and so does reduced motion, which never moves.
 */

import { renderToString } from 'react-dom/server'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnglishIntlProvider } from '@/test/intl'
import { mockMediaQuery } from '@/test/media-query'
import { HeroSquadShowcase } from './hero-squad-showcase'
import { SHOWCASE_HOLD_MS, SHOWCASE_JOIN_MS, SHOWCASE_START_MS } from './use-squad-showcase'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The observers the carousel created, so a spec can move it on and off screen. */
const observers: { callback: IntersectionObserverCallback; disconnected: boolean }[] = []

class ControlledIntersectionObserver {
  private readonly record: (typeof observers)[number]

  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, disconnected: false }
    observers.push(this.record)
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true
  }
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

const OriginalIntersectionObserver = globalThis.IntersectionObserver

function setOnScreen(visible: boolean) {
  act(() => {
    for (const observer of observers.filter((entry) => !entry.disconnected)) {
      observer.callback(
        [
          {
            isIntersecting: visible,
            intersectionRatio: visible ? 1 : 0,
          } as IntersectionObserverEntry,
        ],
        observer as unknown as IntersectionObserver
      )
    }
  })
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds)
  })
}

function centreCard(): HTMLElement {
  const carousel = screen.getByRole('region', { name: 'Squads forming right now' })
  return within(carousel).getByRole('group')
}

/** The centre squad's accessible name: its name, game and count. */
function centre(): string {
  return centreCard().getAttribute('aria-label') ?? ''
}

const valorant = (count: number) =>
  `Premier quinta à noite, a Valorant squad: ${count} of 5 players`
const apex = (count: number) =>
  `Trio ranked até Diamante, a Apex Legends squad: ${count} of 3 players`

function renderShowcase() {
  return render(
    <EnglishIntlProvider>
      <HeroSquadShowcase />
    </EnglishIntlProvider>
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  globalThis.IntersectionObserver =
    ControlledIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  vi.useRealTimers()
  globalThis.IntersectionObserver = OriginalIntersectionObserver
  observers.length = 0
  vi.restoreAllMocks()
})

describe('HeroSquadShowcase', () => {
  it('shows the first squad full in the server HTML', () => {
    const html = renderToString(
      <EnglishIntlProvider>
        <HeroSquadShowcase />
      </EnglishIntlProvider>
    )

    expect(html).toContain(valorant(5))
    expect(html).toContain('Full')
  })

  describe('with motion allowed', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, false)
    })

    it('rewinds the first squad to its founders and waits until it is on screen', () => {
      renderShowcase()

      expect(centre()).toBe(valorant(2))
      expect(within(centreCard()).queryByText('Full')).not.toBeInTheDocument()

      advance(10_000)

      expect(centre()).toBe(valorant(2))
    })

    it('fills the centre squad one player at a time and says so once it is full', () => {
      renderShowcase()
      setOnScreen(true)

      advance(SHOWCASE_START_MS)
      expect(centre()).toBe(valorant(3))
      expect(within(centreCard()).queryByText('Full')).not.toBeInTheDocument()

      advance(SHOWCASE_JOIN_MS)
      advance(SHOWCASE_JOIN_MS)
      expect(centre()).toBe(valorant(5))
      expect(within(centreCard()).getByText('Full')).toBeInTheDocument()
    })

    it('holds the full squad, then gives the centre to the next squad from its start', () => {
      renderShowcase()
      setOnScreen(true)
      advance(SHOWCASE_START_MS)
      advance(SHOWCASE_JOIN_MS)
      advance(SHOWCASE_JOIN_MS)

      advance(SHOWCASE_HOLD_MS - 1)
      expect(centre()).toBe(valorant(5))

      advance(1)
      expect(centre()).toBe(apex(1))
      expect(
        screen.getByRole('button', { name: 'Show Trio ranked até Diamante (Apex Legends)' })
      ).toHaveAttribute('aria-current', 'true')
    })

    it('holds while the pointer is on it, and goes on once it leaves', () => {
      renderShowcase()
      setOnScreen(true)
      const carousel = screen.getByRole('region', { name: 'Squads forming right now' })

      fireEvent.pointerEnter(carousel, { pointerType: 'mouse' })
      advance(10_000)
      expect(centre()).toBe(valorant(2))

      fireEvent.pointerLeave(carousel)
      advance(SHOWCASE_START_MS)
      expect(centre()).toBe(valorant(3))
    })

    it('stops while it is off screen', () => {
      renderShowcase()
      setOnScreen(true)
      setOnScreen(false)

      advance(10_000)

      expect(centre()).toBe(valorant(2))
    })

    it('stops for good with the pause control, and goes on with play', () => {
      renderShowcase()
      setOnScreen(true)

      fireEvent.click(screen.getByRole('button', { name: 'Pause the carousel' }))
      fireEvent.blur(screen.getByRole('button', { name: 'Resume the carousel' }))
      advance(10_000)
      expect(centre()).toBe(valorant(2))

      fireEvent.click(screen.getByRole('button', { name: 'Resume the carousel' }))
      fireEvent.blur(screen.getByRole('button', { name: 'Pause the carousel' }))
      advance(SHOWCASE_START_MS)
      expect(centre()).toBe(valorant(3))
    })

    it('brings the squad a bar names to the centre, from its start', () => {
      renderShowcase()

      fireEvent.click(
        screen.getByRole('button', { name: 'Show Trio ranked até Diamante (Apex Legends)' })
      )

      expect(centre()).toBe(apex(1))
    })
  })

  describe('under reduced motion', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, true)
    })

    it('keeps the first squad full, never moves and offers no pause', () => {
      renderShowcase()
      setOnScreen(true)

      advance(30_000)

      expect(centre()).toBe(valorant(5))
      expect(screen.queryByRole('button', { name: 'Pause the carousel' })).not.toBeInTheDocument()
    })

    it('brings the squad a bar names to the centre, full', () => {
      renderShowcase()

      fireEvent.click(
        screen.getByRole('button', { name: 'Show Trio ranked até Diamante (Apex Legends)' })
      )

      expect(centre()).toBe(apex(3))
    })
  })
})
