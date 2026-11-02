import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJumpPastTrack } from './use-jump-past-track'

/** An element whose layout, in page coordinates while the page sits at its top, is `top` and `height`. */
function placed(id: string, top: number, height: number): HTMLElement {
  const element = document.createElement('section')
  element.id = id
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
  Object.defineProperty(element, 'offsetHeight', { value: height })
  document.body.append(element)
  return element
}

/** A link to `#id`, clicked as a plain left click; returns whether the page handled it itself. */
function clickLinkTo(id: string, init: MouseEventInit = {}): boolean {
  const link = document.createElement('a')
  link.href = `#${id}`
  document.body.append(link)
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init })
  link.dispatchEvent(event)
  return event.defaultPrevented
}

let scrollTo: ReturnType<typeof vi.spyOn>
let skipping: () => boolean

beforeEach(() => {
  // The track is pinned from 2000 to 2000 + 2700 - the viewport (768 in jsdom).
  const track = placed('track', 2000, 2700)
  placed('jogos', 900, 600)
  placed('faq', 4700, 800)
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  // A stable ref, as the stage's `useRef` is.
  const ref = { current: track }
  const { result } = renderHook(() => useJumpPastTrack(ref))
  skipping = () => result.current
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useJumpPastTrack', () => {
  it('skips the pinned part to a section past the track, then glides in, and puts it in the address', () => {
    expect(clickLinkTo('faq')).toBe(true)

    // 3932 is where the stage is released: 2000 + 2700 - 768.
    expect(scrollTo.mock.calls).toEqual([
      [{ top: 3932, behavior: 'instant' }],
      [{ top: 4700, behavior: 'smooth' }],
    ])
    expect(window.location.hash).toBe('#faq')
  })

  it('skips the pinned part on the way up too, from the track start', () => {
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(5000)
    // The layout is read from the viewport, which has moved with the page.
    for (const element of document.querySelectorAll('section')) {
      const top = (element.getBoundingClientRect() as DOMRect).top
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: top - 5000 } as DOMRect)
    }

    expect(clickLinkTo('jogos')).toBe(true)

    expect(scrollTo.mock.calls).toEqual([
      [{ top: 2000, behavior: 'instant' }],
      [{ top: 900, behavior: 'smooth' }],
    ])
  })

  it('is skipping from the jump until the glide ends at the section', () => {
    expect(skipping()).toBe(false)
    act(() => {
      clickLinkTo('faq')
    })
    expect(skipping()).toBe(true)

    // The instant jump ends a scroll of its own, short of the section: still skipping.
    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(3932)
    act(() => {
      window.dispatchEvent(new Event('scrollend'))
    })
    expect(skipping()).toBe(true)

    vi.spyOn(window, 'scrollY', 'get').mockReturnValue(4700)
    act(() => {
      window.dispatchEvent(new Event('scrollend'))
    })
    expect(skipping()).toBe(false)
  })

  it('leaves a link that does not cross the track to the smooth scroll', () => {
    expect(clickLinkTo('jogos')).toBe(false)

    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('leaves the track itself, reached from above, to the smooth scroll', () => {
    expect(clickLinkTo('track')).toBe(false)
  })

  it('leaves a click that opens the link elsewhere alone', () => {
    expect(clickLinkTo('faq', { ctrlKey: true })).toBe(false)
    expect(clickLinkTo('faq', { button: 1 })).toBe(false)

    expect(scrollTo).not.toHaveBeenCalled()
  })
})
