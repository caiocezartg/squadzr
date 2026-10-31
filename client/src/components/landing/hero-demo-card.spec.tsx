/**
 * The hero demo card (CCC-115): the squad fills from 2/5 to 5/5 once, when the card is visible, and
 * holds its final state. Under reduced motion it is always in the final state.
 */

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMediaQuery } from '@/test/media-query'
import { HeroDemoCard } from './hero-demo-card'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The observers the card created, so a spec can report it entering the viewport. */
const observers: {
  callback: IntersectionObserverCallback
  disconnected: boolean
}[] = []

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

function enterViewport() {
  act(() => {
    for (const observer of observers.filter((entry) => !entry.disconnected)) {
      observer.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
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

function count(): string {
  const counter = screen.getByText(
    (_, element) => element?.tagName === 'P' && /^\d\/5$/.test(element.textContent ?? '')
  )
  return counter.textContent ?? ''
}

/** The toasts on show, in the order they stand in the stack. */
function visibleToasts(): string[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-visible]'), (toast) =>
    (toast.textContent ?? '').replace(/\s+/g, ' ')
  )
}

/** The newest toast on show, or `null` when none shows. */
function visibleToast(): string | null {
  return visibleToasts().at(-1) ?? null
}

/** The row each visible toast stands in: no two share one. */
function visibleRows(): (string | undefined)[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-visible]'),
    (toast) => toast.dataset.row
  )
}

const inviteUnlocked = () => document.querySelector('[data-unlocked]') !== null
const ringLit = () => document.querySelector('[data-complete]') !== null

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

describe('HeroDemoCard', () => {
  describe('with motion allowed', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, false)
    })

    it('starts at 2/5 with the invite still locked', () => {
      render(<HeroDemoCard />)

      expect(count()).toBe('2/5')
      expect(inviteUnlocked()).toBe(false)
      expect(ringLit()).toBe(false)
      expect(visibleToast()).toBeNull()
    })

    it('waits until the card is visible before it plays', () => {
      render(<HeroDemoCard />)

      advance(10_000)

      expect(count()).toBe('2/5')
    })

    it('fills a member every 900ms, 600ms after the card is visible', () => {
      render(<HeroDemoCard />)
      enterViewport()

      advance(599)
      expect(count()).toBe('2/5')
      advance(1)
      expect(count()).toBe('3/5')
      expect(visibleToast()).toContain('Brunão joined')
      expect(visibleToast()).toContain('3/5')

      advance(899)
      expect(count()).toBe('3/5')
      advance(1)
      expect(count()).toBe('4/5')
      expect(visibleToast()).toContain('kz_dex joined')
      expect(inviteUnlocked()).toBe(false)

      advance(900)
      expect(count()).toBe('5/5')
      expect(visibleToast()).toContain('luhzinha joined')
      expect(inviteUnlocked()).toBe(true)
      expect(ringLit()).toBe(true)
    })

    it('gives each toast its own place in the stack, so one that is leaving is never covered', () => {
      render(<HeroDemoCard />)
      enterViewport()

      advance(600 + 900)
      expect(visibleToasts()).toHaveLength(2)
      expect(visibleToasts()[0]).toContain('Brunão joined')
      expect(visibleToasts()[1]).toContain('kz_dex joined')

      expect(new Set(visibleRows()).size).toBe(2)

      // The third comes in while the second is still there; the first has left by then.
      advance(900)
      expect(visibleToasts()).toHaveLength(2)
      expect(visibleToasts()[0]).toContain('kz_dex joined')
      expect(visibleToasts()[1]).toContain('luhzinha joined')
      expect(new Set(visibleRows()).size).toBe(2)
    })

    it('takes each toast away 1.6s after it came in', () => {
      render(<HeroDemoCard />)
      enterViewport()
      advance(600)
      expect(visibleToast()).toContain('Brunão joined')

      advance(1599)
      expect(visibleToast()).not.toBeNull()
      advance(1)

      // The second toast came in at 900ms, so the first one's leaving does not take it away.
      expect(visibleToast()).toContain('kz_dex joined')

      advance(2000)
      expect(visibleToast()).toBeNull()
    })

    it('holds the final state and never loops or replays', () => {
      render(<HeroDemoCard />)
      enterViewport()
      advance(600 + 900 * 2 + 1600)

      expect(count()).toBe('5/5')
      expect(visibleToast()).toBeNull()
      expect(inviteUnlocked()).toBe(true)

      advance(60_000)
      enterViewport()
      advance(60_000)

      expect(count()).toBe('5/5')
      expect(visibleToast()).toBeNull()
      expect(inviteUnlocked()).toBe(true)
    })

    it('stops its timers when the page goes away', () => {
      const { unmount } = render(<HeroDemoCard />)
      enterViewport()
      advance(700)

      unmount()

      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('with reduced motion', () => {
    beforeEach(() => {
      mockMediaQuery(REDUCED_MOTION_QUERY, true)
    })

    it('shows the final state and never rewinds', () => {
      render(<HeroDemoCard />)

      expect(count()).toBe('5/5')
      expect(inviteUnlocked()).toBe(true)
      expect(ringLit()).toBe(true)
      expect(visibleToast()).toBeNull()
    })

    it('does not wait for the card or play when it becomes visible', () => {
      render(<HeroDemoCard />)

      enterViewport()
      advance(10_000)

      expect(observers).toHaveLength(0)
      expect(count()).toBe('5/5')
      expect(visibleToast()).toBeNull()
    })
  })

  it('describes the card once, in its final state, to assistive technology', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)
    render(<HeroDemoCard />)

    expect(screen.getAllByRole('img')[0]).toHaveAccessibleName(
      'Illustration: a Valorant squad called Premier quinta à noite fills up to 5 of 5 players and unlocks its Discord invite.'
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
