/**
 * Where the hero's squadmates float before they fly in. Each has a spot in headline ems from the
 * headline's top centre; the hero turns it into an offset from the player's own seat, which the fly-in
 * starts from, picks the spot for the width, measures again when the headline resizes, and shows a
 * player only once it is placed.
 */

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnglishIntlProvider } from '@/test/intl'
import { mockMediaQuery } from '@/test/media-query'
import { HeroSection } from './hero-section'

interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

/** The headline's box and size; every other element answers as a 44px seat at (150, 400). */
let headlineBox: Box = { left: 0, top: 100, width: 400, height: 240 }
const HEADLINE_SIZE = '50px'
const SEAT_BOX: Box = { left: 150, top: 400, width: 44, height: 44 }

function rect({ left, top, width, height }: Box): DOMRect {
  return {
    left,
    top,
    width,
    height,
    x: left,
    y: top,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }
}

let resizeCallbacks: ResizeObserverCallback[] = []

class RecordingResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback)
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** The flyer of the squadmate named `name`: the element the fly-in moves. */
function flyerOf(name: string): HTMLElement {
  const flyer = screen.getByText(name).closest<HTMLElement>('[data-placed]')
  if (!flyer) throw new Error(`${name} was never placed`)
  return flyer
}

function offsetOf(name: string) {
  const flyer = flyerOf(name)
  return [flyer.style.getPropertyValue('--fly-x'), flyer.style.getPropertyValue('--fly-y')]
}

function renderHero() {
  return render(
    <EnglishIntlProvider>
      <HeroSection />
    </EnglishIntlProvider>
  )
}

const SetupResizeObserver = globalThis.ResizeObserver

beforeEach(() => {
  headlineBox = { left: 0, top: 100, width: 400, height: 240 }
  resizeCallbacks = []
  globalThis.ResizeObserver = RecordingResizeObserver as unknown as typeof ResizeObserver
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement
  ) {
    return rect(this.tagName === 'H1' ? headlineBox : SEAT_BOX)
  })
  const computed = window.getComputedStyle.bind(window)
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
    const style = computed(element, pseudo)
    if (element.tagName !== 'H1') return style
    return { ...style, fontSize: HEADLINE_SIZE } as CSSStyleDeclaration
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  globalThis.ResizeObserver = SetupResizeObserver
})

describe('the hero squadmates', () => {
  it('float at their phone spot, as an offset from their own seat', () => {
    renderHero()

    // mia.f's phone spot is (2.2em, 1.6em) from the headline's top centre (200, 100), at 50px.
    // Seat centre: (172, 422). So (200 + 110 - 172, 100 + 80 - 422).
    expect(offsetOf('mia.f')).toEqual(['138.0px', '-242.0px'])
  })

  it('take their wide spot from 1280px', () => {
    mockMediaQuery('(min-width: 80rem)', true)
    renderHero()

    // mia.f's wide spot is (5em, 0.45em): (200 + 250 - 172, 100 + 22.5 - 422).
    expect(offsetOf('mia.f')).toEqual(['278.0px', '-299.5px'])
  })

  it('are placed again when the headline resizes', () => {
    renderHero()

    headlineBox = { left: 100, top: 100, width: 400, height: 240 }
    act(() => {
      for (const callback of resizeCallbacks) callback([], {} as ResizeObserver)
    })

    expect(offsetOf('mia.f')).toEqual(['238.0px', '-242.0px'])
  })

  it('are all placed, so every one of them can show', () => {
    renderHero()

    for (const name of ['mia.f', 'brunão', 'kz_dex', 'luiza']) {
      expect(flyerOf(name)).toHaveAttribute('data-placed')
    }
  })
})
