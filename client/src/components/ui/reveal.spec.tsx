/**
 * The in-view reveal. Its state is the `data-reveal` attribute the global styles animate: no state is
 * the content as rendered, `hidden` waits out of sight, `shown` plays the reveal once.
 */

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockMediaQuery } from '@/test/media-query'
import { Reveal } from './reveal'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** The observers the reveals created, so a spec can report an element entering the viewport. */
const observers: {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  disconnected: boolean
}[] = []

class ControlledIntersectionObserver {
  private readonly record: (typeof observers)[number]

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { callback, options, disconnected: false }
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

function placeBelowViewport() {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: window.innerHeight + 400,
  } as DOMRect)
}

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

beforeEach(() => {
  globalThis.IntersectionObserver =
    ControlledIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  globalThis.IntersectionObserver = OriginalIntersectionObserver
  observers.length = 0
  vi.restoreAllMocks()
})

describe('Reveal', () => {
  it('leaves content that is in view on the first render as it is', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)

    render(<Reveal data-testid="section">Squads</Reveal>)

    expect(screen.getByTestId('section')).not.toHaveAttribute('data-reveal')
    expect(observers).toHaveLength(0)
  })

  it('hides content below the viewport and reveals it once when it enters', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)
    placeBelowViewport()

    render(<Reveal data-testid="section">Squads</Reveal>)
    const section = screen.getByTestId('section')
    expect(section).toHaveAttribute('data-reveal', 'hidden')

    enterViewport()
    expect(section).toHaveAttribute('data-reveal', 'shown')
    expect(observers.every((observer) => observer.disconnected)).toBe(true)
  })

  it('reveals by a viewport margin and not a share of the element, so a tall element still reveals', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)
    placeBelowViewport()

    render(<Reveal>Squads</Reveal>)

    expect(observers).toHaveLength(1)
    expect(observers[0]?.options).toEqual({ rootMargin: '0px 0px -15% 0px' })
  })

  it('reveals the children one after another when staggered', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, false)
    placeBelowViewport()

    render(
      <Reveal as="ul" stagger>
        <li>Valorant</li>
        <li>Dota 2</li>
      </Reveal>
    )
    enterViewport()

    const list = screen.getByRole('list')
    expect(list).toHaveAttribute('data-reveal', 'shown')
    expect(list).toHaveAttribute('data-reveal-stagger')
  })

  it('renders the final state under reduced motion, before and after entering the viewport', () => {
    mockMediaQuery(REDUCED_MOTION_QUERY, true)
    placeBelowViewport()

    render(<Reveal data-testid="section">Squads</Reveal>)
    const section = screen.getByTestId('section')
    expect(section).not.toHaveAttribute('data-reveal')
    expect(section).toHaveTextContent('Squads')

    enterViewport()
    expect(section).not.toHaveAttribute('data-reveal')
  })
})
