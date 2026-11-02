import { renderHook } from '@testing-library/react'
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

beforeEach(() => {
  // The track is pinned from 2000 to 2000 + 2700 - the viewport (768 in jsdom).
  const track = placed('track', 2000, 2700)
  placed('jogos', 900, 600)
  placed('faq', 4700, 800)
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  renderHook(() => useJumpPastTrack({ current: track }))
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useJumpPastTrack', () => {
  it('jumps straight to a section past the track, and puts it in the address', () => {
    expect(clickLinkTo('faq')).toBe(true)

    expect(scrollTo).toHaveBeenCalledWith({ top: 4700, behavior: 'instant' })
    expect(window.location.hash).toBe('#faq')
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
